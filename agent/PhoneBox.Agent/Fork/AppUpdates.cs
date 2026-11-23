namespace PhoneBox.Agent.Fork;

/// <summary>
/// The tablet app's updates (docs/fork/DESIGN.md, "CI/CD"). The app asks every 15 minutes for a newer APK and installs
/// it itself (SelfUpdate.kt). It reports each step back, so the settings page shows what the tablet runs and why an
/// update did not land; "update now" there asks the panel to check at once instead of waiting for the next round.
/// </summary>
public sealed class AppUpdates(UpdateService updates, ILogger<AppUpdates> log)
{
    private readonly UpdateService _updates = updates;
    private static readonly TimeSpan PushFor = TimeSpan.FromMinutes(2);
    private DateTimeOffset _pushUntil;

    public sealed record Report(string Text, DateTimeOffset At);

    /// <summary>The tablet's last word on its update, or null before it said anything.</summary>
    public Report? Last { get; private set; }

    /// <summary>Whether an ask from the settings page waits for the tablet (it expires after two minutes).</summary>
    public bool Pushed => DateTimeOffset.UtcNow < _pushUntil;

    public void Push() => _pushUntil = DateTimeOffset.UtcNow + PushFor;

    /// <summary>The tablet's question "should I check now?": yes once per push.</summary>
    public bool Take()
    {
        var pushed = Pushed;
        _pushUntil = default;
        return pushed;
    }

    public void Reported(string text)
    {
        if (text != Last?.Text) log.LogInformation("tablet app update: {Text}", text);
        Last = new Report(text, DateTimeOffset.UtcNow);
    }

    public static void Map(WebApplication app)
    {
        // The app asks with its own version; 204 while it is current, else the newer APK (X-Version names it).
        app.MapGet("/api/fork/app", async (string have, AppUpdates apps, HttpContext ctx, CancellationToken ct) =>
        {
            var apk = await apps._updates.LatestApkAsync(ct);
            if (apk is not { } a || !ForkApi.IsNewer(a.Version, have)) { apps.Reported($"версия {have} актуальна"); return Results.NoContent(); }
            apps.Reported($"{have}: скачивает {a.Version}");
            ctx.Response.Headers["X-Version"] = a.Version;
            return Results.File(a.Path, "application/vnd.android.package-archive");
        });
        app.MapPost("/api/fork/app/status", (string text, AppUpdates apps) => { apps.Reported(text[..Math.Min(text.Length, 300)]); return Results.Ok(); });
        app.MapPost("/api/fork/app/now", (AppUpdates apps) => { apps.Push(); return Results.Ok(); });
        app.MapPost("/api/fork/app/take", (AppUpdates apps) => Results.Json(new { push = apps.Take() }));
        app.MapGet("/api/fork/app/state", (AppUpdates apps) => Results.Json(new
        {
            push = apps.Pushed, installed = apps._updates.Status().AppVersion, latest = apps._updates.Status().Latest, last = apps.Last,
        }));
    }
}
