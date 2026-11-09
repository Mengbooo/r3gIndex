export interface ScrollController {
  to(value: number, options?: { immediate?: boolean }): void;
  cancel(): void;
  refresh(): void;
  destroy(): void;
}

/** Animate native scrollY, keeping sticky positioning, anchors, and touch native. */
export function initializeScroll(): ScrollController {
  const abort = new AbortController();
  const { signal } = abort;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const dampingTime = 170;
  let current = scrollY, target = current, lastWritten = current;
  let frame = 0, previousTime = 0, maximum = 0;
  const bounded = (value: number) => Math.max(0, Math.min(maximum, value));
  function refresh() {
    maximum = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    target = bounded(target);
  }
  function cancel() {
    cancelAnimationFrame(frame);
    frame = previousTime = 0;
    current = target = lastWritten = scrollY;
  }
  function write(value: number) {
    window.scrollTo({ top: value, behavior: 'instant' });
    lastWritten = scrollY;
  }
  function step(time: number) {
    frame = 0;
    const elapsed = previousTime ? Math.min(64, time - previousTime) : 16.67;
    previousTime = time;
    current += (target - current) * (1 - Math.exp(-elapsed / dampingTime));
    if (Math.abs(target - current) < .35) {
      write(target);
      previousTime = 0;
      return;
    }
    write(current);
    frame = requestAnimationFrame(step);
  }
  function start() {
    if (!frame) { previousTime = 0; frame = requestAnimationFrame(step); }
  }
  function to(value: number, options: { immediate?: boolean } = {}) {
    refresh(); current = scrollY; target = bounded(Number(value) || 0);
    if (motion.matches || options.immediate) {
      cancelAnimationFrame(frame); frame = previousTime = 0;
      current = target; write(current);
    } else start();
  }
  window.addEventListener('wheel', event => {
    if (motion.matches || !event.cancelable || event.ctrlKey ||
      Math.abs(event.deltaX) > Math.abs(event.deltaY) ||
      (event.target instanceof Element && event.target.closest('textarea,select,[data-native-scroll]'))) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
    const delta = event.deltaY * unit;
    if (!delta) return;
    refresh(); if (!frame) current = target = scrollY;
    const next = bounded(target + delta);
    if (next === target && current === target) return;
    event.preventDefault(); target = next; start();
  }, { passive: false, signal });
  window.addEventListener('scroll', () => {
    if (Math.abs(scrollY - lastWritten) > 3) cancel();
  }, { passive: true, signal });
  window.addEventListener('touchstart', cancel, { passive: true, signal });
  window.addEventListener('pointerdown', event => {
    if (event.clientX >= document.documentElement.clientWidth) cancel();
  }, { passive: true, signal });
  window.addEventListener('keydown', event => {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) cancel();
  }, { signal });
  window.addEventListener('resize', refresh, { passive: true, signal });
  window.addEventListener('load', () => { cancel(); refresh(); }, { signal });
  motion.addEventListener('change', cancel, { signal });
  const resize = new ResizeObserver(refresh); resize.observe(document.body); refresh();
  return { to, cancel, refresh, destroy() { cancel(); abort.abort(); resize.disconnect(); } };
}
