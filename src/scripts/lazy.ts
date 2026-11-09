export type Dispose = () => void;
/** Imports a renderer only as its section approaches; handles in-flight teardown. */
export function mountNearby(selector: string, mount: (element: HTMLElement) => Promise<Dispose | void>, margin = '700px'): Dispose {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return () => {};
  let disposed = false;
  let cleanup: Dispose | void;
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    mount(element).then(result => {
      if (disposed) result?.(); else cleanup = result;
    }).catch(error => { console.warn(`Could not initialize ${selector}.`, error); });
  }, { rootMargin: margin });
  observer.observe(element);
  return () => { disposed = true; observer.disconnect(); cleanup?.(); };
}
