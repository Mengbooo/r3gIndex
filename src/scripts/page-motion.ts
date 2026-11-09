import type { ScrollController } from './scroll';
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => v * v * (3 - 2 * v);

/** All scroll effects read the same native scroll position once per frame. */
export function initializePageMotion(scroll: ScrollController): () => void {
  const hero = document.querySelector<HTMLElement>('.hero');
  const intro = document.querySelector<HTMLElement>('.intro-panel');
  const reel = document.querySelector<HTMLElement>('.reel-track');
  const screen = document.querySelector<HTMLElement>('.reel-screen');
  const main = document.querySelector('main');
  if (!hero || !intro || !reel || !screen || !main) return () => {};
  const abort = new AbortController(), { signal } = abort;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const blocks = [...document.querySelectorAll<HTMLElement>('.reveal-text')].map(element => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: node => node.parentElement?.closest('[aria-hidden="true"]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    const texts: Text[] = [], words: HTMLSpanElement[] = [];
    while (walker.nextNode()) texts.push(walker.currentNode as Text);
    texts.forEach(text => {
      const fragment = document.createDocumentFragment();
      (text.textContent ?? '').split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { fragment.append(part); return; }
        const span = document.createElement('span'); span.className = 'word'; span.textContent = part;
        words.push(span); fragment.append(span);
      });
      text.replaceWith(fragment);
    });
    return { element, words };
  });
  type Box = { top: number; height: number };
  let geometry: { intro: Box; reel: Box; reveals: Box[] };
  let frame = 0;
  const position = (element: HTMLElement): Box => {
    const r = element.getBoundingClientRect(); return { top: r.top + scrollY, height: r.height };
  };
  function update() {
    frame = 0;
    if (!geometry) return;
    const y = scrollY, h = innerHeight;
    const cover = clamp((y - (geometry.intro.top - h * .65)) / (h * .65));
    hero!.style.opacity = String(1 - cover);
    hero!.style.transform = motion.matches ? 'none' : `translate3d(0,${-cover * 35}px,0) scale(${1 - cover * .025})`;
    hero!.style.visibility = cover > .999 ? 'hidden' : 'visible';
    blocks.forEach(({ words }, index) => {
      const box = geometry.reveals[index];
      const progress = clamp((h * .82 - (box.top - y)) / Math.max(h * .53, box.height + h * .15));
      words.forEach((word, i) => {
        const amount = motion.matches ? 1 : clamp(progress * 1.3 - i / words.length);
        const level = 1 - clamp(amount * 4);
        const color = `rgb(${Math.round(51 + 147 * level)},${Math.round(53 + 148 * level)},${Math.round(57 + 151 * level)})`;
        if (word.style.color !== color) word.style.color = color;
      });
    });
    const progress = motion.matches ? 1 : smooth(clamp((h - (geometry.reel.top - y)) / (h * .95)));
    screen!.style.transform = `scale(${.4 + .6 * progress})`;
    screen!.style.borderRadius = `${30 - 25 * progress}px`;
  }
  function measure() {
    geometry = { intro: position(intro!), reel: position(reel!), reveals: blocks.map(({ element }) => position(element)) };
    scroll.refresh(); update();
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  window.addEventListener('scroll', schedule, { passive: true, signal });
  window.addEventListener('resize', measure, { passive: true, signal });
  window.addEventListener('load', measure, { signal });
  motion.addEventListener('change', measure, { signal });
  const resize = new ResizeObserver(measure); resize.observe(main);
  document.fonts.ready.then(() => { if (!signal.aborted) measure(); });
  measure();
  return () => { abort.abort(); resize.disconnect(); cancelAnimationFrame(frame); };
}
