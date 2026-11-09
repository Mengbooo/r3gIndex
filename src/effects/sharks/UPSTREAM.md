# ascii-sharks — prototype-1 adaptation

Source: https://github.com/stackedlol/ascii-sharks (MIT; see LICENSE).

The original simulation and supersampled shark silhouettes are retained. Local changes:
- Transparent canvas instead of an opaque black grid.
- Glyph-only shark silhouettes in #1e3fd8, with opacity-based depth shading.
- Denser character grid (about 3× the original desktop density), using only letters/digits from `design`, `code` and `r3g`.
- Only sharks are drawn: small fish, wakes, particles and splash/eating effects are hidden. Fish simulation remains active for shark pursuit.
- Proportional fish/shark positions and sizes on responsive resize.
- Optional fish population and document-visibility pause in OceanEngine.
- Engine destruction and offscreen / reduced-motion pause are retained.

The adapted TypeScript is built by Astro/Vite. The upstream MIT notice is in
`licenses/ascii-sharks-MIT.txt`. There is no separate vendor build step.
