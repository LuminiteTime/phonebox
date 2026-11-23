using System.Text.Json;

namespace PhoneBox.Agent.Fork;

/// <summary>
/// The fork's own endpoints (docs/fork/DESIGN.md), all under /api/fork so one line in the USB and Wi-Fi allow-lists
/// covers them and an upstream merge touches nothing else.
/// </summary>
public static class ForkApi
{
    public static void AddFork(this IServiceCollection services)
    {
        Monitor<Digest>(services);
        Monitor<DevStatus>(services);
        Monitor<GpuProcesses>(services);
        Monitor<ClaudeTokens>(services);
        services.AddSingleton<YandexMusic>();
    }

    private static void Monitor<T>(IServiceCollection services) where T : class, IHostedService
    {
        services.AddSingleton<T>();
        services.AddHostedService(sp => sp.GetRequiredService<T>());
    }

    public static void MapFork(this WebApplication app)
    {
        // The app asks with its own version; 204 while it is current, else the newer APK (X-Version names it).
        app.MapGet("/api/fork/app", async (string have, UpdateService upd, HttpContext ctx, CancellationToken ct) =>
        {
            var apk = await upd.LatestApkAsync(ct);
            if (apk is not { } a || !IsNewer(a.Version, have)) return Results.NoContent();
            ctx.Response.Headers["X-Version"] = a.Version;
            return Results.File(a.Path, "application/vnd.android.package-archive");
        });

        app.MapGet("/api/fork/digest", (Digest digest) => Results.Json(new { items = digest.Items, mirror = digest.Mirror }));
        app.MapPost("/api/fork/digest/open", (string? id, Digest digest) =>
            digest.Open(id) is { } error ? Results.BadRequest(new { error }) : Results.Ok(new { ok = true }));

        app.MapGet("/api/fork/claude", (ClaudeTokens tokens) => Results.Json(new { week = tokens.Week }));
        app.MapGet("/api/fork/gpu", (GpuProcesses gpu) => Results.Json(new { top = gpu.Top }));
        app.MapGet("/api/fork/music", async (YandexMusic music, CancellationToken ct) =>
        {
            try { return Results.Json(new { token = music.HasToken, liked = await music.LikedAsync(LikedShown, ct) }); }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException or KeyNotFoundException)
            { return Results.Json(new { token = music.HasToken, liked = Array.Empty<LikedTrack>(), error = ex.Message }); }
        });
        app.MapPost("/api/fork/music/{rating:regex(^(like|dislike)$)}", async (string rating, YandexMusic music, CancellationToken ct) =>
        {
            try { return await music.RateAsync(rating == "like", ct) is { } error ? Results.BadRequest(new { error }) : Results.Ok(new { ok = true }); }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException or KeyNotFoundException)
            { return Results.BadRequest(new { error = "Яндекс недоступен: " + ex.Message }); }
        });
        app.MapPost("/api/fork/music/wave", () => OpenOnMac("https://music.yandex.ru/"));
        app.MapPost("/api/fork/music/track", (string id) =>
            long.TryParse(id, out var track) ? OpenOnMac($"https://music.yandex.ru/track/{track}") : Results.BadRequest());
        app.MapGet("/api/fork/dev", (DevStatus dev) => Results.Json(new { servers = dev.Servers, vpn = dev.Vpn }));
        app.MapPost("/api/fork/dev/open", (int port, DevStatus dev) =>
            dev.Open(port) is { } error ? Results.BadRequest(new { error }) : Results.Ok(new { ok = true }));
    }

    private const int LikedShown = 12;

    private static IResult OpenOnMac(string url) { Open(url); return Results.Ok(new { ok = true }); }

    /// <summary>Hands an address to the Mac's default browser (open(1), the address as one argument, no shell).</summary>
    internal static void Open(string url)
    {
        var psi = new System.Diagnostics.ProcessStartInfo(OperatingSystem.IsMacOS() ? "/usr/bin/open" : "xdg-open") { UseShellExecute = false };
        psi.ArgumentList.Add(url);
        using var _ = System.Diagnostics.Process.Start(psi);
    }

    internal static bool IsNewer(string candidate, string current) =>
        Version.TryParse(candidate, out var a) && Version.TryParse(current.Split('-', '+')[0], out var b) && a > b;
}
