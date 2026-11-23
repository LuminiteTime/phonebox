namespace PhoneBox.Agent.Fork;

/// <summary>
/// The fork's own endpoints (docs/fork/DESIGN.md), all under /api/fork so one line in the USB and Wi-Fi allow-lists
/// covers them and an upstream merge touches nothing else.
/// </summary>
public static class ForkApi
{
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

        app.MapGet("/api/fork/dev", (DevStatus dev) => Results.Json(new { servers = dev.Servers, vpn = dev.Vpn }));
        app.MapPost("/api/fork/dev/open", (int port, DevStatus dev) =>
            dev.Open(port) is { } error ? Results.BadRequest(new { error }) : Results.Ok(new { ok = true }));
    }

    internal static bool IsNewer(string candidate, string current) =>
        Version.TryParse(candidate, out var a) && Version.TryParse(current.Split('-', '+')[0], out var b) && a > b;
}
