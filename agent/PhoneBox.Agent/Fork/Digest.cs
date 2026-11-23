using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace PhoneBox.Agent.Fork;

/// <summary>One article of the digest. <see cref="Read"/> is where it opens: the paywall mirror for Medium.</summary>
public sealed record DigestItem(string Id, string Title, string Source, string Meta, int Score, long Published, string Url, string Read);

/// <summary>
/// The reading digest of the Dev page (docs/fork/DESIGN.md): broad IT and AI, filtered by quality instead of topic.
///  - Habr: the daily and weekly tops, only "medium" or "high" complexity, rated at least <see cref="HabrMinScore"/>,
///    from the development, administration and AI flows (no pop science or marketing).
///  - Hacker News: the front page with at least <see cref="HnMinPoints"/> points.
///  - Medium: engineering publications that are good as a whole (no rating is reachable: Medium's API sits behind
///    Cloudflare), plus Medium links that made the HN front page. Medium opens through a paywall mirror that is checked
///    to return a full article; when none does, the original link.
/// </summary>
public sealed partial class Digest(ILogger<Digest> log) : BackgroundService
{
    internal const int HabrMinScore = 15, HnMinPoints = 150;
    private static readonly string[] HabrFlows = ["develop", "admin", "ai_and_ml"];
    private static readonly string[] HabrTops = ["https://habr.com/ru/articles/top/daily/", "https://habr.com/ru/articles/top/weekly/"];
    private const string HnFront = "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=50";
    // Engineering blogs only: open publications (Towards AI, Level Up Coding) were mostly clickbait.
    // ponytail: a fixed list; a setting when someone wants other ones
    private static readonly string[] MediumFeeds =
    [
        "https://netflixtechblog.com/feed", "https://medium.com/feed/airbnb-engineering", "https://eng.lyft.com/feed",
        "https://medium.com/feed/pinterest-engineering", "https://medium.com/feed/expedia-group-tech",
    ];
    private const int PerMediumFeed = 2, MediumDays = 14;
    /// <summary>Mirrors tried in order; each takes the article address appended to it.</summary>
    internal static readonly string[] Mirrors = ["https://freedium-mirror.cfd/", "https://freedium.cfd/", "https://readmedium.com/"];
    private static readonly TimeSpan Every = TimeSpan.FromMinutes(30), MirrorCheckEvery = TimeSpan.FromHours(6);

    private readonly HttpClient _http = NewClient();
    private volatile IReadOnlyList<DigestItem> _items = [];
    private string? _mirror;
    private DateTime _mirrorCheckedAt = DateTime.MinValue;

    public IReadOnlyList<DigestItem> Items => _items;
    public string? Mirror => _mirror;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try { await RefreshAsync(ct); }
            catch (Exception ex) when (!ct.IsCancellationRequested) { log.LogWarning("digest: {Msg}", ex.Message); }
            await Task.Delay(Every, ct);
        }
    }

    private async Task RefreshAsync(CancellationToken ct)
    {
        var sources = await Task.WhenAll(Guard(HabrAsync, ct), Guard(HackerNewsAsync, ct), Guard(MediumAsync, ct));
        var medium = sources.SelectMany(s => s).FirstOrDefault(i => IsMedium(i.Url))?.Url;
        if (medium is not null && DateTime.UtcNow - _mirrorCheckedAt > MirrorCheckEvery)
        {
            _mirror = await WorkingMirrorAsync(medium, ct);
            _mirrorCheckedAt = DateTime.UtcNow;
            log.LogInformation("digest: Medium opens through {Mirror}", _mirror ?? "the original site");
        }
        _items = Interleave(sources.Select(s => s.Select(WithReadLink).ToList()).ToList());
    }

    private async Task<List<DigestItem>> Guard(Func<CancellationToken, Task<List<DigestItem>>> source, CancellationToken ct)
    {
        try { return await source(ct); }
        catch (Exception ex) when (!ct.IsCancellationRequested) { log.LogWarning("digest source failed: {Msg}", ex.Message); return []; }
    }

    private DigestItem WithReadLink(DigestItem i) => IsMedium(i.Url) && _mirror is { } m ? i with { Read = m + i.Url } : i;

    /// <summary>Sources take turns, each in its own order (best first), so one source never fills the list.</summary>
    internal static List<DigestItem> Interleave(List<List<DigestItem>> sources)
    {
        var seen = new HashSet<string>();
        var result = new List<DigestItem>();
        for (var i = 0; sources.Any(s => i < s.Count); i++)
            foreach (var s in sources)
                if (i < s.Count && seen.Add(s[i].Url)) result.Add(s[i]);
        return result;
    }

    // ---- Habr: the state the page is rendered from (window.__PINIA_STATE__), which carries complexity and rating

    private async Task<List<DigestItem>> HabrAsync(CancellationToken ct)
    {
        var pages = await Task.WhenAll(HabrTops.Select(u => _http.GetStringAsync(u, ct)));
        return pages.SelectMany(ParseHabr).DistinctBy(i => i.Id).OrderByDescending(i => i.Score).ToList();
    }

    internal static IEnumerable<DigestItem> ParseHabr(string page)
    {
        const string marker = "window.__PINIA_STATE__=";
        var at = page.IndexOf(marker, StringComparison.Ordinal);
        if (at < 0) return [];
        var reader = new Utf8JsonReader(Encoding.UTF8.GetBytes(page[(at + marker.Length)..]));
        using var doc = JsonDocument.ParseValue(ref reader);
        if (!doc.RootElement.TryGetProperty("articlesList", out var list) || !list.TryGetProperty("articlesList", out var refs)) return [];
        var items = new List<DigestItem>();
        foreach (var a in refs.EnumerateObject().Select(p => p.Value))
        {
            var complexity = Str(a, "complexity");
            var score = a.GetProperty("statistics").GetProperty("score").GetInt32();
            var flow = a.TryGetProperty("flowNew", out var f) && f.ValueKind == JsonValueKind.Object ? Str(f, "alias") : null;
            if (complexity is not ("medium" or "high") || score < HabrMinScore || !HabrFlows.Contains(flow)) continue;
            var url = $"https://habr.com/ru/articles/{Str(a, "id")}/";
            var meta = $"{(complexity == "high" ? "сложно" : "средне")} · {a.GetProperty("readingTime").GetInt32()} мин";
            items.Add(new DigestItem(IdOf(url), Plain(Str(a, "titleHtml")), "Habr", meta, score,
                DateTimeOffset.TryParse(Str(a, "timePublished"), out var t) ? t.ToUnixTimeMilliseconds() : 0, url, url));
        }
        return items;
    }

    // ---- Hacker News (Algolia)

    private async Task<List<DigestItem>> HackerNewsAsync(CancellationToken ct)
    {
        using var doc = JsonDocument.Parse(await _http.GetStringAsync(HnFront, ct));
        return ParseHn(doc.RootElement).OrderByDescending(i => i.Score).ToList();
    }

    internal static IEnumerable<DigestItem> ParseHn(JsonElement root)
    {
        foreach (var h in root.GetProperty("hits").EnumerateArray())
        {
            var points = h.TryGetProperty("points", out var p) && p.ValueKind == JsonValueKind.Number ? p.GetInt32() : 0;
            if (points < HnMinPoints) continue;
            var url = Str(h, "url") ?? $"https://news.ycombinator.com/item?id={Str(h, "objectID")}";
            var comments = h.TryGetProperty("num_comments", out var c) && c.ValueKind == JsonValueKind.Number ? c.GetInt32() : 0;
            yield return new DigestItem(IdOf(url), Str(h, "title") ?? "", IsMedium(url) ? "Medium" : "HN",
                $"{points} очк. · {comments} комм.", points, h.GetProperty("created_at_i").GetInt64() * 1000, url, url);
        }
    }

    // ---- Medium publications (RSS, parsed by the upstream feed parser)

    private async Task<List<DigestItem>> MediumAsync(CancellationToken ct)
    {
        var since = DateTimeOffset.UtcNow.AddDays(-MediumDays).ToUnixTimeMilliseconds();
        var feeds = await Task.WhenAll(MediumFeeds.Select(async u =>
        {
            try { return FeedParser.Parse(await _http.GetByteArrayAsync(u, ct), new Uri(u), u, 10).Where(i => i.Published > since).Take(PerMediumFeed); }
            catch (HttpRequestException) { return []; } // one publication down must not empty the others
        }));
        return feeds.SelectMany(f => f).Where(i => i.Link is not null)
            .OrderByDescending(i => i.Published)
            .Select(i => new DigestItem(IdOf(i.Link!), i.Title, "Medium", i.Source, 0, i.Published, StripQuery(i.Link!), StripQuery(i.Link!)))
            .ToList();
    }

    // ---- the paywall mirror: the first one that returns the article's full text

    private async Task<string?> WorkingMirrorAsync(string article, CancellationToken ct)
    {
        foreach (var mirror in Mirrors)
        {
            try
            {
                using var r = await _http.GetAsync(mirror + article, ct);
                if (r.IsSuccessStatusCode && ArticleText(await r.Content.ReadAsStringAsync(ct)) >= MinArticleChars) return mirror;
            }
            catch (Exception ex) when (!ct.IsCancellationRequested) { log.LogInformation("digest: mirror {Mirror} failed: {Msg}", mirror, ex.Message); }
        }
        return null;
    }

    internal const int MinArticleChars = 2000;

    /// <summary>Characters of paragraph text in a page: a mirror that shows only a teaser or a challenge has few.</summary>
    internal static int ArticleText(string html) => Paragraph().Matches(html).Sum(m => Tag().Replace(m.Groups[1].Value, "").Length);

    // ---- opening on the Mac

    public string? Open(string? id)
    {
        if (_items.FirstOrDefault(i => i.Id == id) is not { } item) return "Этой статьи уже нет в дайджесте";
        if (!Uri.TryCreate(item.Read, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps) return "Нет ссылки";
        ForkApi.Open(uri.AbsoluteUri);
        return null;
    }

    // ---- helpers

    internal static bool IsMedium(string url) =>
        Uri.TryCreate(url, UriKind.Absolute, out var u) && (u.Host == "medium.com" || u.Host.EndsWith(".medium.com")
            || MediumFeeds.Any(f => new Uri(f).Host == u.Host && u.Host != "medium.com"));

    private static string StripQuery(string url) => url.Split('?')[0];
    private static string? Str(JsonElement e, string name) =>
        e.TryGetProperty(name, out var v) ? v.ValueKind == JsonValueKind.String ? v.GetString() : v.ToString() : null;
    private static string Plain(string? html) => WebUtility.HtmlDecode(Tag().Replace(html ?? "", ""));
    private static string IdOf(string url) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(url)))[..12];

    private static HttpClient NewClient()
    {
        var http = new HttpClient { Timeout = TimeSpan.FromSeconds(25) };
        http.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Macintosh) PhoneBox");
        return http;
    }

    [GeneratedRegex("<p[^>]*>(.*?)</p>", RegexOptions.Singleline)] private static partial Regex Paragraph();
    [GeneratedRegex("<[^>]+>")] private static partial Regex Tag();
}
