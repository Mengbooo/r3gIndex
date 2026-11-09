import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://r3actgo.com',
  output: 'static',
  devToolbar: { enabled: false },
  integrations: [sitemap({ filter: (page) => !page.endsWith('/404/') })],
  vite: { build: { rollupOptions: { output: { manualChunks(id) { if (id.includes('/node_modules/three/')) return 'three'; if (id.includes('/node_modules/opentype.js/')) return 'opentype'; } } } } },
});
