using System.Net.Http.Headers;
using System.Text.Json;

namespace PhoneBox.Agent.Fork;

/// <summary>A liked track: what the panel lists.</summary>
public sealed record LikedTrack(string Id, string Title, string Artist);

/// <summary>
/// Yandex Music for the Music page (docs/fork/DESIGN.md): like or dislike what is playing, the liked tracks, and
/// opening My Wave or a track on the Mac. The playing track comes from the system's Now Playing (upstream MediaMonitor)
/// and is found in the catalog by artist and title. The account comes from <see cref="YandexAuth"/>.
/// The API answers some regions only with a token ("Unavailable For Legal Reasons" without one).
/// </summary>
public sealed class YandexMusic(MediaMonitor media, YandexAuth auth)
{
    private readonly HttpClient _http = new() { BaseAddress = new Uri("https://api.music.yandex.net"), Timeout = TimeSpan.FromSeconds(10) };

    /// <summary>Likes (or dislikes) the track Now Playing shows; an error message, or null when done.</summary>
    public async Task<string?> RateAsync(bool like, CancellationToken ct)
    {
        if (!auth.SignedIn) return "Сначала войди в Яндекс";
        if (media.Snapshot() is not { Title.Length: > 0 } now) return "Сейчас ничего не играет";
        var track = await FindAsync($"{now.Artist} {now.Title}", ct);
        if (track is null) return "Не нашёл трек в каталоге";
        var uid = await UidAsync(ct);
        using var body = new FormUrlEncodedContent([new("track-ids", track)]);
        using var r = await SendAsync(HttpMethod.Post, $"/users/{uid}/{(like ? "likes" : "dislikes")}/tracks/add-multiple", body, ct);
        return r.IsSuccessStatusCode ? null : $"Яндекс ответил {(int)r.StatusCode}";
    }

    /// <summary>The newest liked tracks, newest first.</summary>
    public async Task<IReadOnlyList<LikedTrack>> LikedAsync(int max, CancellationToken ct)
    {
        if (!auth.SignedIn) return [];
        var uid = await UidAsync(ct);
        using var likes = await JsonAsync(HttpMethod.Get, $"/users/{uid}/likes/tracks", null, ct);
        var ids = likes.RootElement.GetProperty("result").GetProperty("library").GetProperty("tracks").EnumerateArray()
            .Take(max).Select(t => t.GetProperty("id").GetString()).ToList();
        if (ids.Count == 0) return [];
        using var body = new FormUrlEncodedContent([new("track-ids", string.Join(",", ids))]);
        using var tracks = await JsonAsync(HttpMethod.Post, "/tracks", body, ct);
        return ParseTracks(tracks.RootElement.GetProperty("result"));
    }

    internal static List<LikedTrack> ParseTracks(JsonElement result) =>
        result.EnumerateArray().Select(t => new LikedTrack(
            t.GetProperty("id").ToString(), t.GetProperty("title").GetString() ?? "",
            string.Join(", ", t.GetProperty("artists").EnumerateArray().Select(a => a.GetProperty("name").GetString())))).ToList();

    /// <summary>"trackId:albumId" of the best catalog match, or null.</summary>
    private async Task<string?> FindAsync(string text, CancellationToken ct)
    {
        using var doc = await JsonAsync(HttpMethod.Get, "/search?type=track&page=0&text=" + Uri.EscapeDataString(text), null, ct);
        return FirstTrack(doc.RootElement.GetProperty("result"));
    }

    internal static string? FirstTrack(JsonElement result)
    {
        if (!result.TryGetProperty("tracks", out var tracks) || tracks.ValueKind != JsonValueKind.Object) return null;
        var first = tracks.GetProperty("results").EnumerateArray().FirstOrDefault();
        if (first.ValueKind != JsonValueKind.Object) return null;
        var album = first.GetProperty("albums").EnumerateArray().Select(a => a.GetProperty("id").ToString()).FirstOrDefault();
        return album is null ? first.GetProperty("id").ToString() : $"{first.GetProperty("id")}:{album}";
    }

    // ponytail: asked on every call (one small request per 5 min); cache it per token if that ever matters
    private async Task<string> UidAsync(CancellationToken ct)
    {
        using var doc = await JsonAsync(HttpMethod.Get, "/account/status", null, ct);
        return doc.RootElement.GetProperty("result").GetProperty("account").GetProperty("uid").ToString();
    }

    private async Task<JsonDocument> JsonAsync(HttpMethod method, string path, HttpContent? body, CancellationToken ct)
    {
        using var r = await SendAsync(method, path, body, ct);
        r.EnsureSuccessStatusCode();
        return await JsonDocument.ParseAsync(await r.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
    }

    private async Task<HttpResponseMessage> SendAsync(HttpMethod method, string path, HttpContent? body, CancellationToken ct)
    {
        var req = new HttpRequestMessage(method, path) { Content = body };
        req.Headers.Authorization = new AuthenticationHeaderValue("OAuth", await auth.AccessTokenAsync(ct) ?? "");
        var r = await _http.SendAsync(req, ct);
        if (r.StatusCode == System.Net.HttpStatusCode.Unauthorized) auth.SignOut(); // revoked: the panel offers to sign in again
        return r;
    }
}
