// The fork's agent endpoints (agent/PhoneBox.Agent/Fork), polled while something on screen shows them.
import { api, toast } from '../../main.js';
import { every } from '../../widgets/helpers.js';

export const fork = { dev: null, digest: null };

const load = (key, path, timeout) => async () => {
  try { fork[key] = await api(path, 'GET', timeout); } catch (_) { return false; } // an upstream agent has none
};

export const pollDev = every(5000, load('dev', '/fork/dev', 2500), 15_000);
export const pollDigest = every(10 * 60_000, load('digest', '/fork/digest', 5000), 30_000);

/** Asks the agent to open something in the Mac's browser; says so either way. */
export async function openOnMac(path) {
  try { await api(path, 'POST', 8000); toast('Открываю на Mac', 'ok'); return true; }
  catch (_) { toast('Mac не открыл ссылку', 'err'); return false; }
}
