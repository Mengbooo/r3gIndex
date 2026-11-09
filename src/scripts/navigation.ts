import type { ScrollController } from './scroll';

export function initializeNavigation(scroll: ScrollController): () => void {
  const nav = document.querySelector<HTMLElement>('.navigation');
  const button = nav?.querySelector<HTMLButtonElement>('.monogram');
  const group = nav?.querySelector<HTMLElement>('.nav-group');
  const shell = nav?.querySelector<SVGSVGElement>('.nav-shape');
  const path = shell?.querySelector('path');
  if (!nav || !button || !group || !shell || !path) return () => {};
  const abort = new AbortController(), { signal } = abort;
  const hover = matchMedia('(hover: hover) and (pointer: fine)');
  let pointerInside = false;
  let explicitOpen = false;
  function update() {
    const open = explicitOpen || (hover.matches && pointerInside);
    nav!.classList.toggle('is-open', open);
    button!.setAttribute('aria-expanded', String(open));
    button!.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    group!.inert = !open;
  }
  function drawShell() {
    const width = nav!.getBoundingClientRect().width;
    const styles = getComputedStyle(nav!);
    const number = (name: string) => parseFloat(styles.getPropertyValue(name));
    const inset = number('--edge'), join = number('--nav-join-radius');
    const control = join * (1 - .552284749831);
    const right = Math.max(0, Math.min(number('--nav-curve'), width - inset - number('--nav-logo-clearance')));
    const p = (n: number) => Number(n.toFixed(3));
    shell!.setAttribute('viewBox', `0 0 ${p(width)} 34`);
    path!.setAttribute('d', `M0 0 V${p(34 + join)} H${p(inset)} C${p(inset)} ${p(34 + control)} ${p(inset + control)} 34 ${p(inset + join)} 34 H${p(width - right)} C${p(width - right * 37 / 87)} 34 ${p(width - right * 45.98 / 87)} 0 ${p(width)} 0 Z`);
  }
  const resize = new ResizeObserver(drawShell); resize.observe(nav); drawShell(); update();
  button.addEventListener('click', event => {
    if (hover.matches && event.detail !== 0) return;
    explicitOpen = !explicitOpen; update();
  }, { signal });
  nav.addEventListener('pointerenter', () => { pointerInside = true; update(); }, { signal });
  nav.addEventListener('pointerleave', () => { pointerInside = false; update(); }, { signal });
  nav.addEventListener('focusout', event => {
    if (!(event.relatedTarget instanceof Node) || !nav.contains(event.relatedTarget)) {
      explicitOpen = false; update();
    }
  }, { signal });
  hover.addEventListener('change', () => { pointerInside = explicitOpen = false; update(); }, { signal });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (group.contains(document.activeElement)) button.focus();
    pointerInside = explicitOpen = false; update();
  }, { signal });
  group.addEventListener('click', () => { explicitOpen = false; pointerInside = false; update(); }, { signal });
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest<HTMLAnchorElement>('a[href^="#"]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const id = link.hash.slice(1), destination = document.getElementById(id);
    if (!destination) return;
    event.preventDefault();
    explicitOpen = pointerInside = false; update();
    const story = document.querySelector<HTMLElement>('.intro-story');
    const top = link.classList.contains('hero-scroll') && story
      ? story.getBoundingClientRect().top + scrollY - innerHeight * .82 - 24
      : id === 'top' ? 0 : destination.getBoundingClientRect().top + scrollY - 100;
    scroll.to(top);
    history.pushState(null, '', id === 'top' ? location.pathname + location.search : `#${id}`);
    // A skip link must move keyboard focus as well as the viewport.
    if (link.classList.contains('skip-link')) {
      destination.tabIndex = -1;
      destination.focus({ preventScroll: true });
    }
  }, { signal });
  return () => { abort.abort(); resize.disconnect(); };
}
