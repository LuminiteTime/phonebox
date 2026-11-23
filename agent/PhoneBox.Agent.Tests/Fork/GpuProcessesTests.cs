using PhoneBox.Agent.Fork;
using Xunit;

namespace PhoneBox.Agent.Tests.Fork;

public class GpuProcessesTests
{
    private const string Sample = """
        +-o AGXDeviceUserClient  <class AGXDeviceUserClient, id 0x1>
            {
              "AppUsage" = ({"API"="Metal","accumulatedGPUTime"=2000000000},{"API"="Metal","accumulatedGPUTime"=500000000})
              "IOUserClientCreator" = "pid 392, WindowServer"
            }
        +-o AGXDeviceUserClient  <class AGXDeviceUserClient, id 0x2>
            {
              "AppUsage" = ()
              "IOUserClientCreator" = "pid 398, runningboardd"
            }
        +-o AGXDeviceUserClient  <class AGXDeviceUserClient, id 0x3>
            {
              "AppUsage" = ({"API"="Metal","accumulatedGPUTime"=100})
              "IOUserClientCreator" = "pid 392, WindowServer"
            }
        """;

    [Fact]
    public void GpuTimeIsSummedPerProcess()
    {
        var used = GpuProcesses.ParseClients(Sample);
        Assert.Equal(2_500_000_100, used[392]);
        Assert.Equal(0, used[398]);
    }

    [Fact]
    public void SharesAreGroupedByAppAndSorted()
    {
        var before = new Dictionary<int, long> { [1] = 0, [2] = 0, [3] = 0, [4] = 100 };
        var now = new Dictionary<int, long> { [1] = 300_000_000, [2] = 200_000_000, [3] = 5_000_000, [4] = 100, [5] = 999 };
        string Name(int pid) => pid is 1 or 2 ? "Google Chrome" : "Finder";
        var top = GpuProcesses.Shares(before, now, elapsedNs: 1_000_000_000, Name);
        Assert.Equal([new GpuUser("Google Chrome", 50)], top); // Finder's 0.5 % is under the floor
    }
}
