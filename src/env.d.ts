/// <reference types="astro/client" />

interface Window {
  siteScroll?: import('./scripts/scroll').ScrollController;
}
