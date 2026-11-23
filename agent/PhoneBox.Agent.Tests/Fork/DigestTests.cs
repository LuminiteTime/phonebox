using System.Text.Json;
using PhoneBox.Agent.Fork;
using Xunit;

namespace PhoneBox.Agent.Tests.Fork;

public class DigestTests
{
    private static string HabrPage(params string[] articles) =>
        "<script>window.__PINIA_STATE__={\"articlesList\":{\"articlesList\":{" + string.Join(",", articles) + "}}};(function(){})</script>";

    private static string Article(string id, string complexity, int score, string flow) =>
        $"\"{id}\":{{\"id\":\"{id}\",\"titleHtml\":\"Title &laquo;{id}&raquo;\",\"complexity\":\"{complexity}\",\"readingTime\":9," +
        $"\"timePublished\":\"2026-11-23T10:00:00+00:00\",\"statistics\":{{\"score\":{score}}},\"flowNew\":{{\"alias\":\"{flow}\"}}}}";

    [Fact]
    public void HabrKeepsRatedArticlesOfMediumComplexityAndUpFromItFlows()
    {
        var items = Digest.ParseHabr(HabrPage(
            Article("1", "high", 40, "develop"), Article("2", "low", 90, "develop"),
            Article("3", "medium", 5, "admin"), Article("4", "medium", 30, "popsci"), Article("5", "medium", 20, "ai_and_ml"))).ToList();
        Assert.Equal(["1", "5"], items.Select(i => i.Url.Split('/')[^2]));
        Assert.Equal("Title «1»", items[0].Title);
        Assert.Equal("сложно · 9 мин", items[0].Meta);
    }

    [Fact]
    public void HabrWithoutTheStateGivesNothing() => Assert.Empty(Digest.ParseHabr("<html></html>"));

    [Fact]
    public void HackerNewsKeepsTheFrontPageAboveThePointsAndMarksMedium()
    {
        using var doc = JsonDocument.Parse("""
            {"hits":[
              {"objectID":"1","title":"Big","url":"https://example.com/a","points":400,"num_comments":10,"created_at_i":1},
              {"objectID":"2","title":"Small","url":"https://example.com/b","points":20,"num_comments":1,"created_at_i":1},
              {"objectID":"3","title":"Ask","points":300,"num_comments":5,"created_at_i":1},
              {"objectID":"4","title":"Paid","url":"https://medium.com/@x/post-1","points":200,"created_at_i":1}]}
            """);
        var items = Digest.ParseHn(doc.RootElement).ToList();
        Assert.Equal(["Big", "Ask", "Paid"], items.Select(i => i.Title));
        Assert.Equal("https://news.ycombinator.com/item?id=3", items[1].Url);
        Assert.Equal("Medium", items[2].Source);
    }

    [Fact]
    public void SourcesTakeTurnsWithoutRepeats()
    {
        static DigestItem I(string url) => new(url, url, "s", "", 0, 0, url, url);
        var mixed = Digest.Interleave([[I("a1"), I("a2"), I("a3")], [I("b1"), I("a1")]]);
        Assert.Equal(["a1", "b1", "a2", "a3"], mixed.Select(i => i.Url));
    }

    [Fact]
    public void AMirrorWithATeaserDoesNotCount()
    {
        Assert.True(Digest.ArticleText("<p>" + new string('x', 1500) + "</p><p><b>" + new string('y', 600) + "</b></p>") >= Digest.MinArticleChars);
        Assert.True(Digest.ArticleText("<div>Just a moment...</div><p>Member-only story</p>") < Digest.MinArticleChars);
    }
}

public class DevStatusTests
{
    [Fact]
    public void ListenersComeFromLsofFields()
    {
        var l = DevStatus.ParseListeners("p616\ncrapportd\nf6\nn*:54479\np19540\ncnode\nf20\nn127.0.0.1:5173\nf21\nn[::1]:5173\n");
        Assert.Equal([(616, "rapportd", 54479), (19540, "node", 5173), (19540, "node", 5173)], l);
    }

    [Theory]
    [InlineData("node", 5173, true)]
    [InlineData("python3.12", 8000, true)]
    [InlineData("redis-server", 6379, true)]
    [InlineData("java", 8080, true)]
    [InlineData("java", 17017, false)]   // an IDE's own port
    [InlineData("ControlCenter", 5000, false)]
    [InlineData("nodemon-helper", 1, false)]
    public void OnlyDevProgramsCount(string program, int port, bool dev) => Assert.Equal(dev, DevStatus.IsDev(program, port));

    [Fact]
    public void TheProjectIsTheWorkingFolder()
    {
        Assert.Equal("phonebox", DevStatus.Project("p1\nfcwd\nn/Users/me/dev/phonebox\n"));
        Assert.Equal("", DevStatus.Project("p1\nfcwd\nn/\n"));
    }

    [Fact]
    public void AConnectedServiceOrATunnelRouteIsAVpn()
    {
        const string list = "Available network connection services in the current set (*=enabled):\n" +
            "* (Connected)      D1E4 VPN (com.wireguard.macos) \"wireguard\"   [VPN:com.wireguard.macos]\n";
        Assert.Equal(new VpnState(true, "wireguard"), DevStatus.ParseVpn(list, "  interface: en0\n"));
        Assert.Equal(new VpnState(true, "utun4"), DevStatus.ParseVpn(list.Replace("(Connected)", "(Disconnected)"), "  interface: utun4\n"));
        Assert.Equal(new VpnState(false, null), DevStatus.ParseVpn("", "  interface: en0\n"));
    }
}
