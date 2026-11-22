// Run: node --test tools/fork/test/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { calm, heat, level } from '../../../android/app/src/main/assets/www/overlay/lib/signal.js';
import { countdown, elapsedPct, paceGap, claudeLimits } from '../../../android/app/src/main/assets/www/overlay/lib/quota.js';

test('level rises at the thresholds and falls with hysteresis', () => {
  assert.equal(level(79), 'ok');
  assert.equal(level(80), 'warn');
  assert.equal(level(90), 'crit');
  assert.equal(level(86, 'crit'), 'crit');
  assert.equal(level(84, 'crit'), 'warn');
  assert.equal(level(76, 'warn'), 'warn');
  assert.equal(level(74, 'warn'), 'ok');
});

test('heat is cool when idle and red at the top', () => {
  assert.match(heat(0), /250\.000\)$/);
  assert.equal(heat(100), 'oklch(0.7 0.19 32)');
  assert.equal(heat(-5), heat(0));
});

test('calm hides jitter and asks to roll only on big moves', () => {
  const c = calm({ band: 3, roll: 12, alpha: 1 });
  assert.deepEqual(c.push(40), { value: 40, big: true });
  assert.equal(c.push(41.5), null);
  assert.deepEqual(c.push(44), { value: 44, big: false });
  assert.deepEqual(c.push(80), { value: 80, big: true });
  assert.equal(c.push(null), null);
});

test('quota pace and countdown', () => {
  const now = 1_000_000_000;
  const limit = { percent: 35, windowSec: 18000, resetsAt: now + 0.34 * 18000_000 };
  assert.equal(Math.round(elapsedPct(limit, now)), 66);
  assert.equal(paceGap(limit, now), 31);
  assert.equal(countdown(6115_000), '1:41:55');
  assert.equal(countdown(2 * 86400_000 + 23 * 3600_000), '2 д 23 ч');
});

test('claudeLimits picks windows by length', () => {
  const q = { providers: [{ id: 'claude', plan: 'Pro', limits: [{ windowSec: 604800, percent: 39 }, { windowSec: 18000, percent: 35 }] }] };
  const { session, week, plan } = claudeLimits(q);
  assert.equal(session.percent, 35);
  assert.equal(week.percent, 39);
  assert.equal(plan, 'Pro');
  assert.deepEqual(claudeLimits(null), { session: null, week: null, plan: undefined });
});

import { dailyUsage, remember } from '../../../android/app/src/main/assets/www/overlay/lib/week.js';

test('weekly record keeps first and last per day and resets with the window', () => {
  const day = 86400_000;
  const start = Date.UTC(2026, 10, 20, 12);
  const limit = (percent) => ({ percent, resetsAt: start + 7 * day, windowSec: 604800 });
  let rec = remember(null, limit(5), start + 1000);
  rec = remember(rec, limit(9), start + 2000);
  rec = remember(rec, limit(15), start + day + 1000);
  const days = dailyUsage(rec, limit(15), start + day + 2000);
  assert.deepEqual(days.slice(0, 3).map((d) => [d.pct, d.when]), [[4, "past"], [6, "today"], [null, "future"]]);
  const next = remember(rec, { ...limit(1), resetsAt: start + 14 * day }, start + 8 * day);
  assert.equal(Object.keys(next.days).length, 1);
});

import { stickyOrder } from '../../../android/app/src/main/assets/www/overlay/lib/order.js';

test('sticky order swaps only on a clear lead', () => {
  const g = (name, cpu) => ({ name, cpu });
  assert.deepEqual(stickyOrder([], [g('a', 10), g('b', 8)]), ['a', 'b']);
  assert.deepEqual(stickyOrder(['a', 'b'], [g('a', 10), g('b', 12)]), ['a', 'b']);
  assert.deepEqual(stickyOrder(['a', 'b'], [g('a', 10), g('b', 14)]), ['b', 'a']);
  assert.deepEqual(stickyOrder(['gone', 'a'], [g('a', 1), g('new', 50)]), ['new', 'a']);
});
