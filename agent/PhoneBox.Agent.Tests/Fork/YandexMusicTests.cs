using System.Text.Json;
using PhoneBox.Agent.Fork;
using Xunit;

namespace PhoneBox.Agent.Tests.Fork;

public class YandexMusicTests
{
    private static JsonElement Json(string s) => JsonDocument.Parse(s).RootElement;

    [Fact]
    public void TheFirstSearchHitKeepsItsAlbumAndCover()
    {
        Assert.Equal(new CatalogTrack("123", "45", "A", "X", "avatars.yandex.net/a/%%"),
            YandexMusic.FirstTrack(Json("""{"tracks":{"results":[{"id":123,"title":"A","artists":[{"name":"X"}],"albums":[{"id":45}],"coverUri":"avatars.yandex.net/a/%%"},{"id":9}]}}""")));
        Assert.Equal("", YandexMusic.FirstTrack(Json("""{"tracks":{"results":[{"id":"7","title":"B","artists":[],"albums":[]}]}}"""))!.Album);
        Assert.Null(YandexMusic.FirstTrack(Json("""{"tracks":{"results":[]}}""")));
        Assert.Null(YandexMusic.FirstTrack(Json("""{"best":null}""")));
    }
}
