import { initializeScroll } from './scroll';
import { initializeNavigation } from './navigation';
import { initializePageMotion } from './page-motion';
import { mountNearby, type Dispose } from './lazy';
import { initializeGradient } from '../effects/gradient-ascii.js';

export function initializeSite(): void {
  document.documentElement.classList.add('js');
  const scroll = initializeScroll();
  window.siteScroll = scroll;
  const cleanups: (Dispose | void)[] = [
    () => scroll.destroy(),
    initializeNavigation(scroll),
    initializePageMotion(scroll),
    initializeGradient(),
    mountNearby('.intro-sharks', async element => {
      const { OceanEngine } = await import('../effects/sharks/engine');
      const engine = new OceanEngine(element as HTMLCanvasElement, [
        { kind: 'classic', size: 1 }, { kind: 'classic', size: .82 },
        { kind: 'classic', size: .7 }, { kind: 'classic', size: .78 },
      ], 72);
      return () => engine.destroy();
    }),
    mountNearby('.labs-identity', async () => {
      const { initializeIdentity } = await import('../effects/labs-identity.js');
      return initializeIdentity();
    }),
    mountNearby('.reel-screen', async () => {
      const { initializeLabs } = await import('./labs-motion');
      return initializeLabs();
    }, '800px'),
    mountNearby('.sticker-board', async element => {
      const { initializeStickers } = await import('../effects/stickers.js');
      return initializeStickers(element);
    }, '900px'),
  ];
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    cleanups.reverse().forEach(cleanup => cleanup?.());
    delete window.siteScroll;
  });
}
