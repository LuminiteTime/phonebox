// Fork overlay entry (docs/fork/DESIGN.md). Imported by main.js next to the upstream widgets, so the fork's
// full-page widgets are registered before the first layout. The look needs a modern WebView; an old one keeps
// the upstream panel.
import { mountBar } from './bar.js';
import './pages/system.js';
import './pages/claude.js';
import './pages/deck.js';
import './pages/music.js';
import './pages/dev.js';

const MODERN = typeof CSS !== 'undefined' && CSS.supports('color', 'oklch(0.5 0.1 200)') && CSS.supports('selector(:has(*))');

// The bar turns the look on (.x-on) while the first page is a fork page, so a stock layout stays stock.
// main.js finishes loading after this module: its page list exists by DOMContentLoaded.
if (MODERN) document.addEventListener('DOMContentLoaded', mountBar, { once: true });
