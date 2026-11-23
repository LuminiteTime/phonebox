using PhoneBox.Agent.Fork;
using Xunit;

namespace PhoneBox.Agent.Tests.Fork;

public class ForkApiTests
{
    [Theory]
    [InlineData("0.9.28.7", "0.9.28", true)]   // the first fork release replaces an upstream app
    [InlineData("0.9.28.7", "0.9.28.6", true)]
    [InlineData("0.9.28.7", "0.9.28.7", false)]
    [InlineData("0.9.28.7", "0.9.29", false)]  // an upstream release merged later is newer
    [InlineData("0.9.28.7", "0.9.28-dev", true)]
    [InlineData("0.9.28.7", "", false)]
    public void ANewerReleaseIsOffered(string candidate, string current, bool newer) =>
        Assert.Equal(newer, ForkApi.IsNewer(candidate, current));
}
