/* A compact typographic identity changes between stacked and horizontal layouts.
   Each piece exits/re-enters its own mask; glyphs never stretch or fade.
   The motion runs locally, without a video, library, or network request. */
export function initializeIdentity() {
const stage = document.querySelector('.labs-identity');

if (stage) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  // Coordinates match the static SVG's stacked composition for graceful fallback.
  const layouts = {
    mark:      [[151, 133], [282, 194]],
    name:      [[167, 242], [104, 210]],
    year:      [[179, 218], [104, 237]],
    design:    [[172, 270], [104, 262]],
    code:      [[206, 297], [289, 300]],
    explore:   [[118, 330], [83, 319]],
    human:     [[149, 354], [104, 289]],
    ascii:     [[179, 384], [320, 327]],
    symbol:    [[112, 268], [48, 252]],
    dots:      [[155, 300], [234, 240]],
    bracket:   [[112, 304], [48, 294]],
    copyright: [[264, 381], [373, 293]],
    index:     [[113, 390], [306, 274]],
  };
  const pieces = [...stage.querySelectorAll('[data-labs-piece]')].map((node, i) => ({
    node,
    ink: node.querySelector('.labs-piece-ink'),
    positions: layouts[node.dataset.labsPiece],
    // Alternate tokens instead of sending every line through the same motion.
    delay: [0, 3, 1, 4, 6, 9, 8, 11, 2, 5, 7, 12, 10][i] * 23,
    travel: node.dataset.labsPiece === 'mark' ? 92 :
      ['symbol', 'dots', 'copyright', 'bracket'].includes(node.dataset.labsPiece) ? 55 : 38,
  }));
  const clamp = value => Math.min(1, Math.max(0, value));
  const easeOut = value => 1 - Math.pow(1 - value, 4);
  const easeIn = value => value * value * value;
  let visible = false;
  let frame = 0;
  let elapsed = 0;
  let lastTime = null;

  function draw(time) {
    // 4.8 second loop, with brief overlapping reveals and readable resting states.
    // Both transitions finish fully before the next hold begins.
    const cycle = time % 4800;
    const returning = cycle >= 2670;
    const start = returning ? 2670 : 650;
    const from = returning ? 1 : 0;
    const to = 1 - from;
    for (const piece of pieces) {
      const local = cycle - start - piece.delay;
      const departure = easeIn(clamp(local / 190));
      const relocation = easeOut(clamp((local - 165) / 170));
      const arrival = easeOut(clamp((local - 240) / 340));
      const source = piece.positions[from];
      const target = piece.positions[to];
      const x = source[0] + (target[0] - source[0]) * relocation;
      const y = source[1] + (target[1] - source[1]) * relocation;
      // A fully hidden interval allows the inner text to wrap from bottom to top.
      const slide = local < 220 ? departure * piece.travel : (arrival - 1) * piece.travel;
      piece.node.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
      piece.ink.setAttribute('transform', `translate(0 ${slide.toFixed(2)})`);
    }
  }

  function tick(now) {
    frame = 0;
    if (lastTime !== null) elapsed += Math.min(now - lastTime, 64);
    lastTime = now;
    draw(elapsed);
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    const playing = visible && !document.hidden && !reducedMotion.matches;
    if (playing && !frame) {
      lastTime = null;
      frame = requestAnimationFrame(tick);
    } else if (!playing) {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = null;
    }
    if (reducedMotion.matches) {
      elapsed = 0;
      draw(0);
    }
  }

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  }, { threshold: 0 });
  observer.observe(stage);
  document.addEventListener('visibilitychange', sync);
  reducedMotion.addEventListener('change', sync);
  draw(0);
  return () => { observer.disconnect(); cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', sync); reducedMotion.removeEventListener('change', sync); };
}
}
