using PhoneBox.Agent.Fork;
using Xunit;

namespace PhoneBox.Agent.Tests.Fork;

public class YandexAuthTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 23, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void ATokenKeepsItsRefreshTokenAndEndsAfterExpiresIn()
    {
        var token = YandexAuth.ParseToken("""{"token_type":"bearer","access_token":"a","refresh_token":"r","expires_in":31536000}""", Now);
        Assert.Equal(new YandexAuth.Token("a", "r", Now.AddDays(365)), token);
    }

    [Fact]
    public void ATokenWithoutRefreshOrWithAnEndlessLifetimeStillParses()
    {
        var token = YandexAuth.ParseToken("""{"access_token":"a","expires_in":124234123534}""", Now);
        Assert.Equal("", token.Refresh);
        Assert.Equal(Now.AddDays(3650), token.Expires);
    }
}
