using System.Diagnostics;
using System.Text.RegularExpressions;

namespace PhoneBox.Agent.Fork;

/// <summary>An app's share of the GPU over the last sample.</summary>
public sealed record GpuUser(string Name, double Percent);

/// <summary>
/// Which apps load the GPU (macOS, Apple GPUs): every Metal client in the IO registry carries the GPU time it used so far
/// (AGXDeviceUserClient › AppUsage › accumulatedGPUTime, in ns). The difference between two samples over the time between
/// them is that app's share. Elsewhere the list stays empty.
/// </summary>
public sealed partial class GpuProcesses(ILogger<GpuProcesses> log) : BackgroundService
{
    private static readonly TimeSpan Every = TimeSpan.FromSeconds(3);
    private const int Shown = 3;

    public IReadOnlyList<GpuUser> Top { get; private set; } = [];

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        if (!OperatingSystem.IsMacOS()) return;
        Dictionary<int, long>? before = null;
        var at = Stopwatch.GetTimestamp();
        var names = new Dictionary<int, string>();
        while (!ct.IsCancellationRequested)
        {
            try
            {
                var psi = new ProcessStartInfo("/usr/sbin/ioreg");
                foreach (var a in new[] { "-r", "-c", "AGXDeviceUserClient", "-l", "-w0" }) psi.ArgumentList.Add(a);
                var now = ParseClients((await ToolProcess.RunAsync(psi, TimeSpan.FromSeconds(5), ct)).Output);
                var elapsedNs = Stopwatch.GetElapsedTime(at).TotalNanoseconds;
                at = Stopwatch.GetTimestamp();
                if (before is not null) Top = Shares(before, now, elapsedNs, pid => names.TryGetValue(pid, out var n) ? n : names[pid] = AppName(pid));
                before = now;
            }
            catch (Exception ex) when (!ct.IsCancellationRequested) { log.LogDebug("gpu processes: {Msg}", ex.Message); }
            await Task.Delay(Every, ct);
        }
    }

    /// <summary>ioreg output → GPU nanoseconds per process id, summed over all of its clients and queues.</summary>
    internal static Dictionary<int, long> ParseClients(string ioreg)
    {
        var used = new Dictionary<int, long>();
        foreach (var node in ioreg.Split("+-o ", StringSplitOptions.RemoveEmptyEntries))
        {
            if (Creator().Match(node) is not { Success: true } creator) continue;
            var pid = int.Parse(creator.Groups[1].Value);
            var ns = GpuTime().Matches(node).Sum(m => long.Parse(m.Groups[1].Value));
            used[pid] = used.GetValueOrDefault(pid) + ns;
        }
        return used;
    }

    /// <summary>The biggest users, grouped by app name, as a share of the wall time between the samples.</summary>
    internal static List<GpuUser> Shares(Dictionary<int, long> before, Dictionary<int, long> now, double elapsedNs, Func<int, string> name) =>
        now.Where(p => before.ContainsKey(p.Key) && p.Value > before[p.Key])
            .GroupBy(p => name(p.Key), p => (p.Value - before[p.Key]) / elapsedNs * 100)
            .Select(g => new GpuUser(g.Key, Math.Round(Math.Min(100, g.Sum()), 1)))
            .Where(u => u.Percent >= 1)
            .OrderByDescending(u => u.Percent).Take(Shown).ToList();

    /// <summary>The app bundle's name ("Google Chrome" for its helpers too), else the program's name.</summary>
    internal static string AppName(int pid)
    {
        try
        {
            using var p = Process.GetProcessById(pid);
            var path = p.MainModule?.FileName ?? "";
            var app = path.IndexOf(".app/", StringComparison.Ordinal);
            return app > 0 ? Path.GetFileName(path[..app]) : p.ProcessName;
        }
        catch (Exception) { return $"pid {pid}"; } // ended, or not ours to read
    }

    [GeneratedRegex("\"IOUserClientCreator\" = \"pid (\\d+),")] private static partial Regex Creator();
    [GeneratedRegex("\"accumulatedGPUTime\"=(\\d+)")] private static partial Regex GpuTime();
}
