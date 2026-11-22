// "Dev": the containers and the reading digest side by side, both upstream widgets in the instrument look.
// ponytail: local dev servers and VPN state need the companion (DESIGN.md, stage 6); the digest is the agent's RSS
// feeds until the companion's filtered digest replaces it.
import { W } from '../../registry.js';
import { cell, label } from '../lib/ui.js';
import { embed, forward } from '../lib/embed.js';

W['x-dev'] = {
  needs: [...new Set([...W.docker.needs, ...W.feeds.needs])],
  bare: true,
  create(box) {
    box.classList.add('x-page', 'x-dev');
    const docker = embed('docker', { title: 'Контейнеры' });
    const digest = embed('feeds', { title: '', open: true, lines: '2' });
    box.append(cell('last', docker.el), cell('end last', label('Дайджест'), digest.el));
    return { update: (kind) => forward([docker, digest], kind) };
  },
};
