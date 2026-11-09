import manifest from '../../config/r2-assets.json';

// Override with an empty string to serve the optimized local copies only.
export const mediaBaseURL = (import.meta.env.PUBLIC_MEDIA_BASE_URL ?? 'https://assets.r3actgo.com/r3g-r2-upload').replace(/\/+$/, '');

export function mediaAsset(name: string) {
  const entry = manifest.files.find(file => file.logicalName === name);
  if (!entry) throw new Error(`Unknown media asset: ${name}`);
  const fallback = `/assets/media/${entry.file}`;
  return { ...entry, src: mediaBaseURL ? `${mediaBaseURL}/${entry.file}` : fallback, fallback };
}

export async function loadMediaImage(name: string): Promise<HTMLImageElement> {
  const { src, fallback } = mediaAsset(name);
  for (const url of new Set([src, fallback])) {
    const image = new Image();
    // Required before src: stickers read alpha pixels and upload the image to WebGL.
    image.crossOrigin = 'anonymous';
    image.src = url;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        image.decode(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Image load timed out')), 10000); }),
      ]);
      return image;
    } catch (error) {
      image.src = '';
      if (url === fallback) throw error;
    } finally { clearTimeout(timer); }
  }
  throw new Error(`Unable to load image: ${name}`);
}

export async function fetchMediaBuffer(name: string): Promise<ArrayBuffer> {
  const { src, fallback } = mediaAsset(name);
  for (const url of new Set([src, fallback])) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`Media request failed: ${response.status}`);
      return await response.arrayBuffer();
    } catch (error) { if (url === fallback) throw error; }
  }
  throw new Error(`Unable to load media: ${name}`);
}
