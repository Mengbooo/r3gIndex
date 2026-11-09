type Scene = Awaited<ReturnType<typeof import('../effects/r3g/scene.js')['createR3gScene']>>;

/** One clock survives every material cut. Pause it offscreen without resetting pose. */
export async function initializeLabs(): Promise<() => void> {
  const screen = document.querySelector<HTMLElement>('#labs .reel-screen');
  const output = screen?.querySelector<HTMLCanvasElement>('.reel-canvas');
  if (!screen || !output) return () => {};
  const abort = new AbortController(), { signal } = abort;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let scene: Scene | undefined;
  let visible = false, frame = 0, elapsed = 0, startedAt = 0, contextLost = false, failed = false;
  const now = () => performance.now() / 1000;
  const time = () => elapsed + (frame ? now() - startedAt : 0);
  const pause = () => {
    if (!frame) return;
    elapsed += now() - startedAt; cancelAnimationFrame(frame); frame = 0;
  };
  const fail = (error: unknown) => {
    pause(); failed = true; screen.dataset.motion = 'error';
    screen.querySelector<HTMLElement>('.reel-webgl')?.style.setProperty('visibility', 'hidden');
    console.warn('The live r3g scene could not render.', error);
  };
  const draw = () => { try { scene?.renderAt(time()); } catch (error) { fail(error); } };
  const tick = () => {
    if (!scene || !visible || document.hidden || motion.matches || contextLost || failed) { pause(); return; }
    draw(); if (!failed) frame = requestAnimationFrame(tick);
  };
  const sync = () => {
    if (!scene || !visible || document.hidden || motion.matches || contextLost || failed) { pause(); return; }
    if (!frame) { startedAt = now(); frame = requestAnimationFrame(tick); }
  };
  const resize = () => {
    if (!scene || contextLost || failed) return;
    scene.resize(screen.clientWidth, screen.clientHeight, devicePixelRatio || 1); draw();
  };
  let density: MediaQueryList;
  const watchDensity = () => {
    density?.removeEventListener('change', densityChanged);
    density = matchMedia(`(resolution: ${devicePixelRatio || 1}dppx)`);
    density.addEventListener('change', densityChanged, { once: true, signal });
  };
  const densityChanged = () => { resize(); watchDensity(); };
  screen.dataset.motion = 'loading';
  try {
    const { createR3gScene } = await import('../effects/r3g/scene.js');
    scene = await createR3gScene(output, { layered: true });
    // Read-only diagnostics are useful for checking continuity across material cuts.
    Object.defineProperty(output, 'r3gScene', { configurable: true, value: Object.freeze({ getState: scene.getState, getDiagnostics: scene.getDiagnostics }) });
    const webgl = screen.querySelector<HTMLCanvasElement>('.reel-webgl');
    webgl?.addEventListener('webglcontextlost', event => {
      event.preventDefault(); contextLost = true; pause(); screen.dataset.motion = 'loading';
    }, { signal });
    webgl?.addEventListener('webglcontextrestored', () => {
      contextLost = false; webgl.style.visibility = ''; resize(); screen.dataset.motion = 'ready'; sync();
    }, { signal });
    resize(); if (!failed) screen.dataset.motion = 'ready';
  } catch (error) { fail(error); }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(screen);
  const visibility = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }); visibility.observe(screen);
  document.addEventListener('visibilitychange', sync, { signal });
  motion.addEventListener('change', () => { sync(); draw(); }, { signal });
  window.addEventListener('resize', resize, { passive: true, signal });
  window.addEventListener('pagehide', pause, { signal });
  window.addEventListener('pageshow', sync, { signal });
  watchDensity();
  return () => { pause(); abort.abort(); visibility.disconnect(); resizeObserver.disconnect(); scene?.dispose(); };
}
