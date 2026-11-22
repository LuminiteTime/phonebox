// Screenshots of the fork's pages in the web demo, at the tablet's landscape size, and a smoke check that they
// render without errors. Start the demo first (python tools/demo-server.py), then:
//   node tools/fork/screens.mjs [outDir]          (uses Playwright from tools/ui-tests)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(new URL('../ui-tests/package.json', import.meta.url));
const { chromium } = require('playwright');

const BASE = process.env.DEMO_URL || 'http://127.0.0.1:8790/panel/';
const OUT = process.argv[2] || 'fork-screens';
const PAGES = ['x-system', 'x-claude', 'x-music', 'x-deck', 'x-dev'];
const VIEWPORT = { width: 1280, height: 800 };

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(BASE);
await page.waitForFunction(() => localStorage.getItem('pb-demo-config'));
// show only the fork's pages, built from the catalog templates like the demo builds its own
await page.evaluate(async (ids) => {
  const templates = await (await fetch('../templates.json')).json();
  const config = JSON.parse(localStorage.getItem('pb-demo-config'));
  config.pages = templates.filter((t) => ids.includes(t.id)).map((t) => ({
    id: t.id, title: t.title, icon: t.icon, enabled: true, appearance: null, idleSec: null,
    widgets: t.widgets.map((w) => ({ ...w, id: w.type, options: {} })),
  }));
  localStorage.setItem('pb-demo-config', JSON.stringify(config));
  localStorage.setItem('pb-demo-version', JSON.stringify(Date.now()));
  localStorage.removeItem('cfg');
}, PAGES);
await page.reload();
await page.waitForSelector('.x-page');
await page.waitForTimeout(4000);

for (let i = 0; i < PAGES.length; i++) {
  await page.evaluate((n) => document.querySelectorAll('#x-bar nav button')[n]?.click(), i);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${PAGES[i]}.png` });
}
await browser.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`screens written to ${OUT}`);
