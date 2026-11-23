// The fork's agent endpoints (agent/PhoneBox.Agent/Fork), polled while something on screen shows them.
import { api, toast } from '../../main.js';
import { every } from '../../widgets/helpers.js';

export const fork = { dev: null, digest: null, gpu: null, claude: null, music: null };

const load = (key, path, timeout) => async () => {
  try { fork[key] = await api(path, 'GET', timeout); } catch (_) { return false; } // an upstream agent has none
};

export const pollClaude = every(60_000, load('claude', '/fork/claude', 4000), 15_000);
export const pollMusic = every(5 * 60_000, load('music', '/fork/music', 12_000), 30_000);
export const pollGpu = every(3000, load('gpu', '/fork/gpu', 2500), 15_000);
export const pollDev = every(5000, load('dev', '/fork/dev', 2500), 15_000);
export const pollDigest = every(10 * 60_000, load('digest', '/fork/digest', 5000), 30_000);

/** Asks the agent to open something in the Mac's browser; says so either way. */
export async function openOnMac(path) {
  try { await api(path, 'POST', 8000); toast('Открываю на Mac', 'ok'); return true; }
  catch (_) { toast('Mac не открыл ссылку', 'err'); return false; }
}
