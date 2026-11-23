using System.Text.Json;

namespace PhoneBox.Agent.Fork;

/// <summary>
/// The Yandex account behind the Music page (docs/fork/DESIGN.md). Signs in with OAuth Device Flow, the login of TVs and
/// speakers: the panel shows a short code, the Mac opens Yandex's code page, the person types it there and confirms.
/// The token lives about a year; the refresh token renews it a month before it ends, so nobody signs in again.
/// Tokens stay in ~/.config/phonebox-fork/yandex-music.json (0600), never in the agent's config or its settings page.
/// </summary>
public sealed class YandexAuth
{
    // The Yandex Music Android app's public OAuth client (it ships inside the APK): the Music API takes only its tokens.
    private const string ClientId = "23cabbbdc6cd418abb4b39c32c41195d", ClientSecret = "53bc75238f0c4d08a118e51fe9203300";
    private static readonly TimeSpan RenewBefore = TimeSpan.FromDays(30);
    internal static readonly string TokenFile =
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".config", "phonebox-fork", "yandex-music.json");

    private readonly HttpClient _http = new() { BaseAddress = new Uri("https://oauth.yandex.ru"), Timeout = TimeSpan.FromSeconds(10) };
    private readonly SemaphoreSlim _renew = new(1, 1);

    internal sealed record Token(string Access, string Refresh, DateTimeOffset Expires);

    /// <summary>A sign-in waiting for the person to enter <paramref name="Code"/> at <paramref name="Url"/>.</summary>
    public sealed record Pending(string Code, string Url, DateTimeOffset Until);

    public Pending? Login { get; private set; }

    public bool SignedIn => File.Exists(TokenFile);

    /// <summary>The access token, renewed first when it ends within a month; null when signed out.</summary>
    public async Task<string?> AccessTokenAsync(CancellationToken ct)
    {
        if (Read() is not { } token) return null;
        if (token.Expires - DateTimeOffset.UtcNow > RenewBefore) return token.Access;
        await _renew.WaitAsync(ct);
        try
        {
            token = Read() ?? token; // another caller may have renewed it meanwhile
            if (token.Expires - DateTimeOffset.UtcNow > RenewBefore) return token.Access;
            using var r = await TokenAsync([new("grant_type", "refresh_token"), new("refresh_token", token.Refresh)], ct);
            if (!r.IsSuccessStatusCode) return token.Access; // still valid for weeks: try again on the next call
            var renewed = ParseToken(await r.Content.ReadAsStringAsync(ct), DateTimeOffset.UtcNow);
            Save(renewed.Refresh.Length > 0 ? renewed : renewed with { Refresh = token.Refresh });
            return renewed.Access;
        }
        finally { _renew.Release(); }
    }

    /// <summary>Starts a sign-in (or returns the one under way) and waits for its confirmation in the background.</summary>
    public async Task<Pending> StartLoginAsync(CancellationToken ct)
    {
        if (Login is { } current && current.Until > DateTimeOffset.UtcNow) return current;
        using var body = new FormUrlEncodedContent([new("client_id", ClientId), new("device_id", DeviceId()), new("device_name", "PhoneBox")]);
        using var r = await _http.PostAsync("/device/code", body, ct);
        r.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await r.Content.ReadAsStringAsync(ct));
        var root = doc.RootElement;
        var login = Login = new Pending(root.GetProperty("user_code").GetString()!, root.GetProperty("verification_url").GetString()!,
            DateTimeOffset.UtcNow.AddSeconds(root.GetProperty("expires_in").GetInt32()));
        _ = WaitForConfirmationAsync(root.GetProperty("device_code").GetString()!, Math.Max(3, root.GetProperty("interval").GetInt32()), login);
        return login;
    }

    /// <summary>Forgets the account (the API refused its token: revoked, or the password changed).</summary>
    public void SignOut() => File.Delete(TokenFile);

    private async Task WaitForConfirmationAsync(string deviceCode, int intervalSeconds, Pending login)
    {
        while (DateTimeOffset.UtcNow < login.Until && Login == login)
        {
            await Task.Delay(TimeSpan.FromSeconds(intervalSeconds));
            try
            {
                using var r = await TokenAsync([new("grant_type", "device_code"), new("code", deviceCode)], CancellationToken.None);
                var text = await r.Content.ReadAsStringAsync();
                if (r.IsSuccessStatusCode) { Save(ParseToken(text, DateTimeOffset.UtcNow)); break; }
                if (!text.Contains("authorization_pending")) break; // denied or expired
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException) { } // offline for a moment
        }
        if (Login == login) Login = null;
    }

    private Task<HttpResponseMessage> TokenAsync(KeyValuePair<string, string>[] grant, CancellationToken ct) =>
        _http.PostAsync("/token", new FormUrlEncodedContent([.. grant, new("client_id", ClientId), new("client_secret", ClientSecret)]), ct);

    internal static Token ParseToken(string json, DateTimeOffset now)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var seconds = Math.Min(root.GetProperty("expires_in").GetInt64(), (long)TimeSpan.FromDays(3650).TotalSeconds); // "forever" tokens
        return new Token(root.GetProperty("access_token").GetString()!,
            root.TryGetProperty("refresh_token", out var refresh) ? refresh.GetString() ?? "" : "", now.AddSeconds(seconds));
    }

    private static Token? Read()
    {
        try { return JsonSerializer.Deserialize<Token>(File.ReadAllText(TokenFile)); }
        catch (Exception ex) when (ex is IOException or JsonException) { return null; }
    }

    private static void Save(Token token)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(TokenFile)!);
        AppPaths.WriteAllTextPrivate(TokenFile, JsonSerializer.Serialize(token));
    }

    // the same id on every sign-in, so the account lists this Mac once under Devices (Yandex wants 6 to 50 characters)
    private static string DeviceId() =>
        "phonebox-" + Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(Environment.MachineName)))[..16];
}
