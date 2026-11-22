// Fork overlay entry (docs/fork/DESIGN.md). Imported by main.js next to the upstream widgets, so the fork's
// full-page widgets are registered before the first layout. The look switches on only in a modern WebView;
// an old one keeps the upstream panel.
import { mountBar } from './bar.js';
import './pages/system.js';
import './pages/claude.js';
import './pages/deck.js';
import './pages/music.js';

const MODERN = typeof CSS !== 'undefined' && CSS.supports('color', 'oklch(0.5 0.1 200)') && CSS.supports('selector(:has(*))');

if (MODERN) {
  document.documentElement.classList.add('x-on');
  // main.js finishes loading after this module: its page list exists by DOMContentLoaded
  document.addEventListener('DOMContentLoaded', mountBar, { once: true });
}
