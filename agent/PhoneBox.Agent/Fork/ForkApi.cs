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
        services.AddSingleton<YandexAuth>().AddSingleton<YandexMusic>().AddSingleton<AppUpdates>();
    }

    private static void Monitor<T>(IServiceCollection services) where T : class, IHostedService
    {
        services.AddSingleton<T>();
        services.AddHostedService(sp => sp.GetRequiredService<T>());
    }

    public static void MapFork(this WebApplication app)
    {
        AppUpdates.Map(app);

        app.MapGet("/api/fork/digest", (Digest digest) => Results.Json(new { items = digest.Items, mirror = digest.Mirror }));
        app.MapPost("/api/fork/digest/open", (string? id, Digest digest) =>
            digest.Open(id) is { } error ? Results.BadRequest(new { error }) : Results.Ok(new { ok = true }));

        app.MapGet("/api/fork/claude", (ClaudeTokens tokens) => Results.Json(new { week = tokens.Week }));
        app.MapGet("/api/fork/gpu", (GpuProcesses gpu) => Results.Json(new { top = gpu.Top }));
        app.MapGet("/api/fork/music", async (YandexMusic music, YandexAuth auth, CancellationToken ct) =>
        {
            try { return Results.Json(new { token = auth.SignedIn, login = auth.Login, now = await music.NowAsync(ct), nowLiked = await music.NowLikedAsync(ct) }); }
            catch (Exception ex) when (IsYandexDown(ex)) { return Results.Json(new { token = auth.SignedIn, login = auth.Login, error = ex.Message }); }
        });
        app.MapPost("/api/fork/music/login", (YandexAuth auth, CancellationToken ct) => Yandex(async () =>
        {
            var login = await auth.StartLoginAsync(ct);
            Open(login.Url);
            return Results.Json(login);
        }));
        app.MapPost("/api/fork/music/like", (bool on, YandexMusic music, CancellationToken ct) => Yandex(async () =>
            await music.SetLikeAsync(on, ct) is { } error ? Results.BadRequest(new { error }) : Results.Json(new { liked = on })));
        app.MapPost("/api/fork/music/dislike", (YandexMusic music, CancellationToken ct) => Yandex(async () =>
            await music.DislikeAsync(ct) is { } error ? Results.BadRequest(new { error }) : Results.Ok(new { ok = true })));
        app.MapGet("/api/fork/music/cover", (YandexMusic music, CancellationToken ct) => Yandex(async () =>
            await music.CoverAsync(ct) is { } jpeg ? Results.File(jpeg, "image/jpeg") : Results.NotFound()));
        app.MapGet("/api/fork/dev", (DevStatus dev) => Results.Json(new { servers = dev.Servers, vpn = dev.Vpn }));
        app.MapPost("/api/fork/dev/open", (int port, DevStatus dev) =>
            dev.Open(port) is { } error ? Results.BadRequest(new { error }) : Results.Ok(new { ok = true }));
    }

    private static bool IsYandexDown(Exception ex) =>
        ex is HttpRequestException or TaskCanceledException or JsonException or KeyNotFoundException;

    private static async Task<IResult> Yandex(Func<Task<IResult>> call)
    {
        try { return await call(); }
        catch (Exception ex) when (IsYandexDown(ex)) { return Results.BadRequest(new { error = "Яндекс недоступен: " + ex.Message }); }
    }

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
