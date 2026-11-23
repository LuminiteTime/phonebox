using System.Text.Json;
using PhoneBox.Agent.Fork;
using Xunit;

namespace PhoneBox.Agent.Tests.Fork;

public class YandexMusicTests
{
    private static JsonElement Json(string s) => JsonDocument.Parse(s).RootElement;

    [Fact]
    public void TheFirstSearchHitIsTrackColonAlbum()
    {
        Assert.Equal("123:45", YandexMusic.FirstTrack(Json("""{"tracks":{"results":[{"id":123,"albums":[{"id":45}]},{"id":9,"albums":[]}]}}""")));
        Assert.Equal("7", YandexMusic.FirstTrack(Json("""{"tracks":{"results":[{"id":"7","albums":[]}]}}""")));
        Assert.Null(YandexMusic.FirstTrack(Json("""{"tracks":{"results":[]}}""")));
        Assert.Null(YandexMusic.FirstTrack(Json("""{"best":null}""")));
    }

    [Fact]
    public void TracksKeepTitleAndAllArtists()
    {
        var tracks = YandexMusic.ParseTracks(Json("""[{"id":1,"title":"One More Time","artists":[{"name":"Daft Punk"},{"name":"Romanthony"}]}]"""));
        Assert.Equal([new LikedTrack("1", "One More Time", "Daft Punk, Romanthony")], tracks);
    }
}
