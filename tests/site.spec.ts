import { test, expect } from '@playwright/test';

test('production document has working destinations, metadata and no missing assets', async ({ page }) => {
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
  await page.goto('/');
  await expect(page).toHaveTitle('r3actgo — Design, code & curiosity');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://r3actgo.com/');
  await expect(page.locator('#note-list > a')).toHaveCount(4);
  for (const scope of ['#nav-links', '.footer-link-row', '.labs-description:not(.sticker-description)']) {
    await expect(page.locator(`${scope} a`, { hasText: 'Labs' })).toHaveAttribute('href', 'https://labs.r3actgo.com');
    await expect(page.locator(`${scope} a`, { hasText: 'Blog' })).toHaveAttribute('href', 'https://blog.r3actgo.com');
  }
  await expect(page.locator('a[href="mailto:r3actgo@163.com"]')).toHaveCount(1);
  await expect(page.locator('a[href="https://www.xiaohongshu.com/user/profile/6025423800000000010094a0"]')).toHaveCount(1);
  await expect(page.locator('#work')).toHaveCount(0);
  await page.locator('#labs').scrollIntoViewIfNeeded();
  await expect(page.locator('.reel-screen')).toHaveAttribute('data-motion', 'ready');
  await page.locator('#stickers').scrollIntoViewIfNeeded();
  await expect(page.locator('#stickers')).toHaveAttribute('data-ready', 'true');
  await page.locator('#contact').scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  expect(failures).toEqual([]);
});

test('navigation opens without moving or clipping its logo and closes with Escape', async ({ page }) => {
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Open navigation', exact: true });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  const before = await page.locator('.monogram').boundingBox();
  await page.locator('.monogram').hover();
  await expect(page.locator('.monogram')).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => page.locator('.navigation').evaluate(e => Math.round(e.getBoundingClientRect().width))).toBe(455);
  const after = await page.locator('.monogram').boundingBox();
  expect(after!.x).toBe(before!.x);
  for (const link of await page.locator('#nav-links a').all()) {
    expect(await link.evaluate(e => { const a = e.getBoundingClientRect(), b = e.closest('header')!.getBoundingClientRect(); return a.left >= b.left && a.right <= b.right; })).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('#nav-links')).toHaveAttribute('inert', '');
  await page.locator('.monogram').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(page.locator('#nav-links a').first()).toBeFocused();
});

test('material changes share the exact same angular speed and model geometry', async ({ page }) => {
  await page.goto('/');
  await page.locator('#labs').scrollIntoViewIfNeeded();
  await expect(page.locator('.reel-screen')).toHaveAttribute('data-motion', 'ready');
  // Observe the live renderer across a representation cut; its clock must not reset.
  type Frame = { elapsed: number; mode: string; rotation: { x: number; y: number }; scale: number; cameraZ: number };
  const states: Frame[] = [];
  const sample = () => page.locator('.reel-canvas').evaluate(e => {
    const scene = (e as HTMLCanvasElement & { r3gScene: { getState: () => Frame } }).r3gScene;
    return scene.getState();
  });
  states.push(await sample());
  await expect.poll(async () => {
    const state = await sample();
    states.push(state);
    return new Set(states.map(s => s.mode)).size;
  }, { timeout: 15_000, intervals: [250, 500] }).toBeGreaterThan(1);
  const diagnostics = await page.locator('.reel-canvas').evaluate(e =>
    (e as HTMLCanvasElement & { r3gScene: { getDiagnostics: () => { modelSize: number[] } } }).r3gScene.getDiagnostics());
  const results = { states, diagnostics };
  for (const state of results.states) {
    expect(state.rotation.y).toBeCloseTo(-.24 + state.elapsed * Math.PI * 2 / 6, 9);
    expect(state.rotation.x).toBeCloseTo(-.13, 9);
    expect(state.scale).toBe(.86);
    expect(state.cameraZ).toBe(10.2);
  }
  expect(new Set(results.states.map(s => s.mode)).size).toBeGreaterThan(1);
  expect(results.diagnostics.modelSize[0]).toBeCloseTo(4.35, 4);
});

test('stickers support keyboard placement, clamp above hero, and reach footer', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#stickers').scrollIntoViewIfNeeded();
  await expect(page.locator('#stickers')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.sticker-key-target')).toHaveCount(5);
  const first = page.locator('.sticker-key-target').first();
  await first.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.sticker-global-canvas')).toHaveAttribute('data-active', 'r3g wordmark');
  await page.evaluate(() => {
    const target = document.activeElement!;
    for (let i = 0; i < 500; i++) target.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  });
  await expect.poll(() => page.locator('.sticker-global-canvas').evaluate(e => JSON.parse((e as HTMLElement).dataset.positions!)[0].y)).toBeLessThan(2500);
  const bounds = await page.evaluate(() => ({ top: document.querySelector('#intro .introduction')!.getBoundingClientRect().top + scrollY, bottom: document.querySelector('#contact')!.getBoundingClientRect().bottom + scrollY }));
  let position = await page.locator('.sticker-global-canvas').evaluate(e => JSON.parse((e as HTMLElement).dataset.positions!)[0]);
  expect(position.y - position.h / 2).toBeGreaterThanOrEqual(bounds.top - 1);
  await page.evaluate(() => { for (let i = 0; i < 800; i++) document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); });
  await expect.poll(() => page.locator('.sticker-global-canvas').evaluate(e => JSON.parse((e as HTMLElement).dataset.positions!)[0].y)).toBeGreaterThan(bounds.bottom - 800);
  position = await page.locator('.sticker-global-canvas').evaluate(e => JSON.parse((e as HTMLElement).dataset.positions!)[0]);
  expect(position.y + position.h / 2).toBeLessThanOrEqual(bounds.bottom + 1);
  await page.keyboard.press('Space');
  await expect(page.locator('.sticker-global-canvas')).toHaveAttribute('data-active', 'none');
});

test('touch navigation and narrow layout remain usable', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/');
  await page.locator('.monogram').tap();
  await expect(page.locator('.monogram')).toHaveAttribute('aria-expanded', 'true');
  await page.locator('#nav-links a').first().tap();
  await expect(page.locator('.monogram')).toHaveAttribute('aria-expanded', 'false');
  await page.locator('#contact').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.close();
});

test('without JavaScript content and navigation remain accessible', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('#nav-links a').first()).toBeVisible();
  await expect(page.locator('#nav-links')).not.toHaveAttribute('inert');
  await page.locator('#nav-links a').first().click();
  await expect(page).toHaveURL(/#intro$/);
  await expect(page.locator('#intro-title')).toContainText('Huazhong University');
  await expect(page.locator('.reel-fallback')).toBeVisible();
  await expect(page.locator('.sticker-fallback img')).toHaveCount(5);
  await context.close();
});

test('custom 404 returns a real 404 and a route home', async ({ page }) => {
  const response = await page.goto('/not-a-real-page/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('link', { name: 'Back to r3actgo' })).toHaveAttribute('href', '/');
});
