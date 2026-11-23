using System.Net.Http.Headers;
using System.Text.Json;

namespace PhoneBox.Agent.Fork;

/// <summary>A catalog track. Cover is an avatars address with %% for the size.</summary>
public sealed record CatalogTrack(string Id, string Album, string Title, string Artist, string Cover);

/// <summary>
/// Yandex Music for the Music page (docs/fork/DESIGN.md): the playing track in the catalog (for its large cover and its
/// like), and like / unlike / dislike it.
/// The playing track comes from the system's Now Playing (upstream MediaMonitor) and is found in the catalog by artist
/// and title. The account comes from <see cref="YandexAuth"/>. The API answers some regions only with a token.
/// </summary>
public sealed class YandexMusic(MediaMonitor media, YandexAuth auth)
{
    private readonly HttpClient _http = new() { BaseAddress = new Uri("https://api.music.yandex.net"), Timeout = TimeSpan.FromSeconds(10) };
    private (string Key, CatalogTrack? Track) _now = ("", null);
    private (string Key, byte[] Bytes) _cover = ("", []);

    /// <summary>The playing track in the catalog, or null (nothing plays, signed out, no match). Remembered per song.</summary>
    public async Task<CatalogTrack?> NowAsync(CancellationToken ct)
    {
        if (!auth.SignedIn || media.Snapshot() is not { Title.Length: > 0 } now) return null;
        var key = now.Artist + "\n" + now.Title;
        if (_now.Key == key) return _now.Track;
        using var doc = await JsonAsync(HttpMethod.Get, "/search?type=track&page=0&text=" + Uri.EscapeDataString($"{now.Artist} {now.Title}"), null, ct);
        var track = FirstTrack(doc.RootElement.GetProperty("result"));
        _now = (key, track);
        return track;
    }

    /// <summary>Likes the playing track, or takes the like back when it has one; the new state, or an error.</summary>
    public async Task<(bool Liked, string? Error)> ToggleLikeAsync(CancellationToken ct)
    {
        if (await NowAsync(ct) is not { } track) return (false, NotFound());
        var uid = await UidAsync(ct);
        var liked = (await LikedIdsAsync(uid, ct)).Contains(track.Id);
        var error = await PostIdsAsync($"/users/{uid}/likes/tracks/{(liked ? "remove" : "add-multiple")}", track, ct);
        return (error is null ? !liked : liked, error);
    }

    /// <summary>Dislikes the playing track (Yandex then leaves it out of My Wave); an error, or null.</summary>
    public async Task<string?> DislikeAsync(CancellationToken ct) =>
        await NowAsync(ct) is { } track ? await PostIdsAsync($"/users/{await UidAsync(ct)}/dislikes/tracks/add-multiple", track, ct) : NotFound();

    /// <summary>Whether the playing track is among the liked ones.</summary>
    public async Task<bool> NowLikedAsync(CancellationToken ct) =>
        await NowAsync(ct) is { } now && (await LikedIdsAsync(await UidAsync(ct), ct)).Contains(now.Id);

    /// <summary>The playing track's cover at 800 px (JPEG), or null.</summary>
    public async Task<byte[]?> CoverAsync(CancellationToken ct)
    {
        if (await NowAsync(ct) is not { Cover.Length: > 0 } track) return null;
        if (_cover.Key == track.Id) return _cover.Bytes;
        var bytes = await _http.GetByteArrayAsync("https://" + track.Cover.Replace("%%", "800x800"), ct);
        _cover = (track.Id, bytes);
        return bytes;
    }

    /// <summary>The best catalog match of a search, or null.</summary>
    internal static CatalogTrack? FirstTrack(JsonElement result)
    {
        if (!result.TryGetProperty("tracks", out var tracks) || tracks.ValueKind != JsonValueKind.Object) return null;
        var first = tracks.GetProperty("results").EnumerateArray().FirstOrDefault();
        return first.ValueKind == JsonValueKind.Object ? Track(first) : null;
    }

    private static CatalogTrack Track(JsonElement t) => new(
        t.GetProperty("id").ToString(),
        t.TryGetProperty("albums", out var albums) && albums.GetArrayLength() > 0 ? albums[0].GetProperty("id").ToString() : "",
        t.GetProperty("title").GetString() ?? "",
        string.Join(", ", t.GetProperty("artists").EnumerateArray().Select(a => a.GetProperty("name").GetString())),
        t.TryGetProperty("coverUri", out var cover) ? cover.GetString() ?? "" : "");

    private string NotFound() => media.Snapshot() is { Title.Length: > 0 } ? "Не нашёл трек в каталоге Яндекса" : "Сейчас ничего не играет";

    private async Task<List<string>> LikedIdsAsync(string uid, CancellationToken ct)
    {
        using var likes = await JsonAsync(HttpMethod.Get, $"/users/{uid}/likes/tracks", null, ct);
        return likes.RootElement.GetProperty("result").GetProperty("library").GetProperty("tracks").EnumerateArray()
            .Select(t => t.GetProperty("id").ToString()).ToList();
    }

    private async Task<string?> PostIdsAsync(string path, CatalogTrack track, CancellationToken ct)
    {
        using var body = new FormUrlEncodedContent([new("track-ids", track.Album.Length > 0 ? $"{track.Id}:{track.Album}" : track.Id)]);
        using var r = await SendAsync(HttpMethod.Post, path, body, ct);
        return r.IsSuccessStatusCode ? null : $"Яндекс ответил {(int)r.StatusCode}";
    }

    // ponytail: asked on every call (one small request); cache it per token if that ever matters
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
