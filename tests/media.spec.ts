import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import manifest from '../config/r2-assets.json' with { type: 'json' };

const cdn = 'https://assets.r3actgo.com/r3g-r2-upload/';

for (const offline of [false, true]) {
  test(offline ? 'CDN failure falls back to local images, model and interactive stickers' : 'optimized CDN media loads on demand and supports cross-origin sticker pixels', async ({ page }) => {
    const remote = new Set<string>();
    const local = new Set<string>();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/assets/media/')) local.add(url.pathname.split('/').pop()!);
    });
    // Deterministic CDN responses use the exact upload bytes. Live object availability
    // is checked separately, so the regression suite needs no external network.
    await page.route(`${cdn}**`, async route => {
      const file = new URL(route.request().url()).pathname.split('/').pop()!;
      const asset = manifest.files.find(asset => asset.file === file);
      if (!asset) throw new Error(`Unexpected media request: ${file}`);
      remote.add(file);
      if (offline) return route.abort('failed');
      await route.fulfill({
        path: resolve('public/assets/media', file),
        contentType: asset.contentType,
        headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:4322' },
      });
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('.hero-wordmark')).toBeVisible();
    const model = manifest.files.find(asset => asset.kind === 'model')!;
    expect(remote.has(model.file)).toBe(false);

    await page.locator('#labs').scrollIntoViewIfNeeded();
    await expect(page.locator('.reel-screen')).toHaveAttribute('data-motion', 'ready');
    await page.locator('#stickers').scrollIntoViewIfNeeded();
    await expect(page.locator('#stickers')).toHaveAttribute('data-ready', 'true');
    // Ready requires alpha sampling and WebGL texture uploads to succeed.
    await page.locator('.sticker-key-target').first().focus();
    await page.keyboard.press('Space');
    await expect(page.locator('.sticker-global-canvas')).toHaveAttribute('data-active', 'r3g wordmark');
    await page.keyboard.press('Space');
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await expect.poll(() => page.locator('img[data-media]').evaluateAll(images =>
      images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0),
    )).toBe(true);
    expect([...remote].sort()).toEqual(manifest.files.map(asset => asset.file).sort());
    expect([...local].sort()).toEqual(offline ? manifest.files.map(asset => asset.file).sort() : []);
    expect(errors).toEqual([]);
  });
}
