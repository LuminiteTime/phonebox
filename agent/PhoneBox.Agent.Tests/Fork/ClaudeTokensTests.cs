using PhoneBox.Agent.Fork;
using Xunit;

namespace PhoneBox.Agent.Tests.Fork;

public class ClaudeTokensTests
{
    [Fact]
    public void AnAssistantLineCountsFreshInputCacheWritesAndOutput()
    {
        var u = ClaudeTokens.Usage("""{"type":"assistant","timestamp":"2026-11-22T20:29:14.877Z","message":{"id":"msg_1","model":"claude-opus-5-5","usage":{"input_tokens":2,"cache_creation_input_tokens":25689,"cache_read_input_tokens":23772,"output_tokens":130}}}""");
        Assert.NotNull(u);
        Assert.Equal("msg_1", u.Value.Id);
        Assert.Equal(25821, u.Value.Tokens);
        Assert.Equal(130, u.Value.Output);
        Assert.Equal(DateTimeOffset.Parse("2026-11-22T20:29:14.877Z").ToLocalTime().ToString("yyyy-MM-dd"), u.Value.Day);
    }

    [Theory]
    [InlineData("""{"type":"user","message":{"role":"user","content":"hi"}}""")]
    [InlineData("""{"type":"assistant","message":"usage"}""")]
    [InlineData("""{"usage": broken""")]
    public void OtherLinesCountNothing(string line) => Assert.Null(ClaudeTokens.Usage(line));
}
