using System.Text.Json;

namespace PhoneBox.Agent.Fork;

/// <summary>Claude Code tokens of one local day: fresh input, cache writes and output (cache reads are left out).</summary>
public sealed record TokenDay(string Date, long Tokens, long Output);

/// <summary>
/// Claude Code's tokens by day, read from its session logs (~/.claude/projects/**/*.jsonl, one JSON object per line;
/// assistant lines carry message.usage). A streamed answer repeats its usage on several lines, so each message counts
/// once (message.id). Files are read from where the last pass stopped, so a pass costs only the new lines.
/// </summary>
public sealed class ClaudeTokens(ILogger<ClaudeTokens> log) : BackgroundService
{
    private const int Days = 7;
    private static readonly TimeSpan Every = TimeSpan.FromMinutes(1);
    private static readonly string Root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".claude", "projects");

    private readonly Dictionary<string, long> _offsets = [];
    private readonly HashSet<string> _seen = [];
    private readonly Dictionary<string, (long Tokens, long Output)> _byDay = [];

    public IReadOnlyList<TokenDay> Week { get; private set; } = [];

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try { Scan(); }
            catch (Exception ex) when (!ct.IsCancellationRequested) { log.LogDebug("claude tokens: {Msg}", ex.Message); }
            await Task.Delay(Every, ct);
        }
    }

    private void Scan()
    {
        if (!Directory.Exists(Root)) return;
        var since = DateTime.Now.Date.AddDays(1 - Days);
        foreach (var file in Directory.EnumerateFiles(Root, "*.jsonl", SearchOption.AllDirectories))
        {
            var info = new FileInfo(file);
            if (info.LastWriteTime < since) continue;
            var from = _offsets.GetValueOrDefault(file);
            if (info.Length < from) from = 0; // rewritten
            if (info.Length == from) continue;
            using var stream = new FileStream(file, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
            stream.Seek(from, SeekOrigin.Begin);
            using var reader = new StreamReader(stream);
            var read = from;
            while (reader.ReadLine() is { } line)
            {
                if (reader.EndOfStream && !line.EndsWith('}')) break; // a line still being written: next pass
                read += System.Text.Encoding.UTF8.GetByteCount(line) + 1;
                if (Usage(line) is { } u && _seen.Add(u.Id)) Add(u.Day, u.Tokens, u.Output);
            }
            _offsets[file] = read;
        }
        Week = Enumerable.Range(0, Days).Select(i => since.AddDays(i).ToString("yyyy-MM-dd"))
            .Select(d => new TokenDay(d, _byDay.GetValueOrDefault(d).Tokens, _byDay.GetValueOrDefault(d).Output)).ToList();
    }

    private void Add(string day, long tokens, long output)
    {
        var (t, o) = _byDay.GetValueOrDefault(day);
        _byDay[day] = (t + tokens, o + output);
    }

    /// <summary>One log line → the message id, its local day and its tokens; null for lines without usage.</summary>
    internal static (string Id, string Day, long Tokens, long Output)? Usage(string line)
    {
        if (!line.Contains("\"usage\"")) return null;
        try
        {
            using var doc = JsonDocument.Parse(line);
            var root = doc.RootElement;
            if (!root.TryGetProperty("message", out var m) || m.ValueKind != JsonValueKind.Object || !m.TryGetProperty("usage", out var u)) return null;
            if (!m.TryGetProperty("id", out var id) || !root.TryGetProperty("timestamp", out var ts) || !ts.TryGetDateTimeOffset(out var at)) return null;
            long N(string name) => u.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetInt64() : 0;
            var output = N("output_tokens");
            return (id.GetString() ?? "", at.ToLocalTime().ToString("yyyy-MM-dd"), N("input_tokens") + N("cache_creation_input_tokens") + output, output);
        }
        catch (JsonException) { return null; }
    }
}
