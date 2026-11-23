using System.Diagnostics;

namespace PhoneBox.Agent.Fork;

/// <summary>A local server a developer started: its port, program and project folder.</summary>
public sealed record DevServer(int Port, string Program, string Project, int Pid);

/// <summary>A VPN: up or not, and what it is called (the macOS service name or the tunnel interface).</summary>
public sealed record VpnState(bool On, string? Name);

/// <summary>
/// The Dev page's view of the Mac (docs/fork/DESIGN.md): local dev servers (lsof) and the VPN (scutil and the default
/// route). macOS only; elsewhere both stay empty. Microphone and camera come from the upstream PrivacyMonitor.
/// </summary>
public sealed class DevStatus(ILogger<DevStatus> log) : BackgroundService
{
    // ponytail: a fixed list of dev runtimes and databases; java only on the usual dev ports (IDEs listen too)
    private static readonly string[] DevPrograms =
        ["node", "bun", "deno", "python", "ruby", "php", "go", "dotnet", "uvicorn", "gunicorn", "postgres", "redis-server", "mongod", "mysqld", "java"];
    private static readonly TimeSpan Every = TimeSpan.FromSeconds(10);

    public IReadOnlyList<DevServer> Servers { get; private set; } = [];
    public VpnState Vpn { get; private set; } = new(false, null);

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        if (!OperatingSystem.IsMacOS()) return;
        while (!ct.IsCancellationRequested)
        {
            try
            {
                Servers = await ServersAsync(ct);
                Vpn = ParseVpn(await RunAsync("/usr/sbin/scutil", ["--nc", "list"], ct), await RunAsync("/sbin/route", ["-n", "get", "default"], ct));
            }
            catch (Exception ex) when (!ct.IsCancellationRequested) { log.LogDebug("dev status: {Msg}", ex.Message); }
            await Task.Delay(Every, ct);
        }
    }

    private async Task<IReadOnlyList<DevServer>> ServersAsync(CancellationToken ct)
    {
        var listeners = ParseListeners(await RunAsync("/usr/sbin/lsof", ["+c", "15", "-nP", "-iTCP", "-sTCP:LISTEN", "-Fpcn"], ct));
        var servers = new List<DevServer>();
        foreach (var (pid, program, port) in listeners.Where(l => IsDev(l.Program, l.Port)).DistinctBy(l => l.Port))
            servers.Add(new DevServer(port, program, Project(await RunAsync("/usr/sbin/lsof", ["-a", "-p", pid.ToString(), "-d", "cwd", "-Fn"], ct)), pid));
        return servers.OrderBy(s => s.Port).ToList();
    }

    internal static bool IsDev(string program, int port)
    {
        var name = program.ToLowerInvariant();
        if (name == "java") return port is >= 3000 and < 10000;
        return DevPrograms.Any(p => name == p || name.StartsWith(p + "3") || name.StartsWith(p + "-"));
    }

    /// <summary>lsof -F output (p&lt;pid&gt;, c&lt;command&gt;, n&lt;address:port&gt; lines) → one entry per listening socket.</summary>
    internal static List<(int Pid, string Program, int Port)> ParseListeners(string output)
    {
        var result = new List<(int, string, int)>();
        int pid = 0;
        var program = "";
        foreach (var line in output.Split('\n', StringSplitOptions.RemoveEmptyEntries))
        {
            switch (line[0])
            {
                case 'p': int.TryParse(line[1..], out pid); break;
                case 'c': program = line[1..]; break;
                case 'n' when int.TryParse(line[(line.LastIndexOf(':') + 1)..], out var port): result.Add((pid, program, port)); break;
            }
        }
        return result;
    }

    /// <summary>The project a server runs in: the last folder of its working directory ("" for / or unknown).</summary>
    internal static string Project(string lsofCwd)
    {
        var path = lsofCwd.Split('\n').LastOrDefault(l => l.StartsWith('n'))?[1..].TrimEnd('/') ?? "";
        return Path.GetFileName(path);
    }

    /// <summary>A connected macOS VPN service wins; else a default route through a tunnel (apps that skip the system list).</summary>
    internal static VpnState ParseVpn(string ncList, string defaultRoute)
    {
        var connected = ncList.Split('\n').FirstOrDefault(l => l.Contains("(Connected)"));
        if (connected is not null)
        {
            var start = connected.IndexOf('"');
            var end = start < 0 ? -1 : connected.IndexOf('"', start + 1);
            return new VpnState(true, end > start ? connected[(start + 1)..end] : "VPN");
        }
        var iface = defaultRoute.Split('\n').Select(l => l.Trim()).FirstOrDefault(l => l.StartsWith("interface:"))?["interface:".Length..].Trim();
        return iface is not null && iface.StartsWith("utun") ? new VpnState(true, iface) : new VpnState(false, null);
    }

    /// <summary>Opens a local server in the Mac's browser.</summary>
    public string? Open(int port)
    {
        if (Servers.All(s => s.Port != port)) return "Этот сервер уже остановлен";
        ForkApi.Open($"http://localhost:{port}");
        return null;
    }

    private static async Task<string> RunAsync(string file, string[] args, CancellationToken ct)
    {
        var psi = new ProcessStartInfo(file);
        foreach (var a in args) psi.ArgumentList.Add(a);
        return (await ToolProcess.RunAsync(psi, TimeSpan.FromSeconds(5), ct)).Output;
    }
}
