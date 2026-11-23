// "Dev": containers and local servers on the left, the reading digest on the right.
import { W } from '../../registry.js';
import { cell } from '../lib/ui.js';
import { embed, forward } from '../lib/embed.js';
import { digestCell, serversCell } from '../cells/dev.js';

W['x-dev'] = {
  needs: [...new Set([...W.docker.needs, 'tick'])],
  bare: true,
  create(box) {
    box.classList.add('x-page', 'x-dev');
    const docker = embed('docker', { title: 'Контейнеры' });
    const servers = serversCell();
    const digest = digestCell();
    box.append(cell('', docker.el), digest.el, servers.el);
    return {
      update(kind) {
        forward([docker], kind);
        if (kind === 'tick') { servers.update(); digest.update(); }
      },
    };
  },
};
