// Prepare a hashed R2 upload package; update config/r2-assets.json and local fallbacks when adopting it.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import * as THREE from 'three';
import opentype from 'opentype.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import { dedup, prune } from '@gltf-transform/functions';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(process.argv[2] || join(root, '.r2-upload'));
await mkdir(output, { recursive: true });
if ((await readdir(output)).length) throw new Error(`Output must be empty: ${output}`);
const files = [];
async function save(logicalName, extension, bytes, details) {
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const file = `${logicalName}.${sha256.slice(0, 12)}.${extension}`;
  await writeFile(join(output, file), bytes);
  files.push({ logicalName, file, bytes: bytes.length, sha256, ...details });
}
for (const name of ['01-r3g-wordmark', '06-smiling-flower', '02-ascii-shark', '03-terminal', '07-ai-chip']) {
  const source = `public/assets/stickers/${name}.webp`;
  const input = await readFile(join(root, source));
  const data = await sharp(input).resize({ width: 768, withoutEnlargement: true })
    .webp({ quality: 86, alphaQuality: 100, effort: 6 }).toBuffer();
  await save(name, 'webp', data, { kind: 'sticker', source, originalBytes: input.length, width: 768, height: 768, contentType: 'image/webp' });
}
for (const name of ['r3g-curiosity-seal', 'r3g-design-code-seal', 'r3g-human-ai-seal']) {
  const source = `public/assets/footer/${name}.svg`;
  const input = await readFile(join(root, source));
  const data = await sharp(input).resize({ width: 600, height: 600, fit: 'inside' })
    .webp({ lossless: true, effort: 6 }).toBuffer();
  const { width, height } = await sharp(data).metadata();
  await save(name, 'webp', data, { kind: 'footer', source, originalBytes: input.length, width, height, contentType: 'image/webp' });
}
const poster = await readFile(join(root, 'public/assets/r3g-poster.webp'));
await save('r3g-poster', 'webp', poster, { kind: 'poster', source: 'public/assets/r3g-poster.webp', originalBytes: poster.length, contentType: 'image/webp' });

// Match scene.js exactly: glyph outline, extrusion, centring, scale and point sampling.
const fontBytes = await readFile(join(root, 'public/assets/fonts/redaction-35/Redaction35-Bold.ttf'));
const font = opentype.parse(fontBytes.buffer.slice(fontBytes.byteOffset, fontBytes.byteOffset + fontBytes.byteLength));
const path = new THREE.ShapePath();
for (const v of font.getPath('r3g', 0, 0, 220, { kerning: true }).commands) {
  if (v.type === 'M') path.moveTo(v.x, -v.y);
  else if (v.type === 'L') path.lineTo(v.x, -v.y);
  else if (v.type === 'Q') path.quadraticCurveTo(v.x1, -v.y1, v.x, -v.y);
  else if (v.type === 'C') path.bezierCurveTo(v.x1, -v.y1, v.x2, -v.y2, v.x, -v.y);
  else if (v.type === 'Z') path.currentPath.closePath();
}
const shapes = path.toShapes();
const raw = new THREE.ExtrudeGeometry(shapes, { depth: 24, steps: 1, bevelEnabled: true, bevelSegments: 4, bevelSize: 3, bevelThickness: 3, curveSegments: 20 });
raw.computeBoundingBox();
const originalBox = raw.boundingBox.clone();
const k = 4.35 / originalBox.getSize(new THREE.Vector3()).x;
const center = originalBox.getCenter(new THREE.Vector3());
raw.translate(-center.x, -center.y, -center.z);
raw.scale(k, k, k);
raw.computeVertexNormals();
raw.computeBoundingBox();
// UVs are unused by the current procedural materials. Preserve normal seams.
raw.deleteAttribute('uv');
const meshGeometry = mergeVertices(raw, 1e-7);
const group = new THREE.Group(); group.name = 'r3g';
const mesh = new THREE.Mesh(meshGeometry, new THREE.MeshStandardMaterial({ color: 0x1e3fd8, metalness: .28, roughness: .3 }));
mesh.name = 'r3g-model'; group.add(mesh);
const contours = [];
for (const s of shapes) { contours.push(s.getPoints(90)); for (const h of s.holes) contours.push(h.getPoints(55)); }
const outlines = new THREE.Group(); outlines.name = 'r3g-contours'; group.add(outlines);
const anchors = [];
contours.forEach((pts, i) => {
  for (const [side, depth] of [['back', 0], ['front', 24]]) {
    const geometry = new THREE.BufferGeometry().setFromPoints(pts.map(v => new THREE.Vector3((v.x - center.x) * k, (v.y - center.y) * k, (depth - center.z) * k)));
    const line = new THREE.LineLoop(geometry, new THREE.MeshBasicMaterial({ color: 0x1e3fd8 }));
    line.name = `contour-${i}-${side}`; outlines.add(line);
  }
  for (let j = 0; j < pts.length; j += Math.max(2, Math.floor(pts.length / 12))) {
    anchors.push([(pts[j].x - center.x) * k, (pts[j].y - center.y) * k, (24 - center.z) * k]);
  }
});
const polygons = shapes.map(s => ({ outer: s.getPoints(75), holes: s.holes.map(h => h.getPoints(45)) }));
function contains(pts, px, py) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if (((a.y > py) !== (b.y > py)) && px < (b.x - a.x) * (py - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
const positions = [], seeds = [];
const fract = n => n - Math.floor(n);
const hash = n => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
for (let y = -1.65; y < 1.65; y += .026) for (let x = -2.2; x < 2.2; x += .026) {
  const px = x / k + center.x, py = y / k + center.y;
  if (polygons.some(p => contains(p.outer, px, py) && !p.holes.some(h => contains(h, px, py)))) {
    for (const z of [-.16, .16]) { positions.push(x, y, z); seeds.push(hash(positions.length)); }
  }
}
const pointGeometry = new THREE.BufferGeometry();
pointGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
pointGeometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
const points = new THREE.Points(pointGeometry, new THREE.MeshBasicMaterial({ color: 0x1e3fd8 }));
points.name = 'r3g-points'; group.add(points);
const modelSize = raw.boundingBox.getSize(new THREE.Vector3()).toArray();
group.userData = { version: 1, modelSize, anchors, contourCount: contours.length };
// GLTFExporter only needs Blob-to-ArrayBuffer FileReader in this texture-free export.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }).catch(error => this.onerror?.(error)); }
};
const exported = await new GLTFExporter().parseAsync(group, { binary: true });
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const document = await io.readBinary(new Uint8Array(exported));
await document.transform(dedup(), prune());
// Lossless Meshopt encoding: do not quantize or simplify the accepted model.
document.createExtension(EXTMeshoptCompression).setRequired(true)
  .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
const binary = await io.writeBinary(document);
// Validate the actual shipped file, including exact triangle positions/normals.
const loaded = await io.readBinary(binary);
const nodes = loaded.getRoot().listNodes();
const primitive = nodes.find(n => n.getName() === 'r3g-model').getMesh().listPrimitives()[0];
const attributes = { position: 'POSITION', normal: 'NORMAL' };
const actualPositions = primitive.getAttribute('POSITION').getArray();
const actualNormals = primitive.getAttribute('NORMAL').getArray();
const indices = primitive.getIndices()?.getArray();
const count = indices ? indices.length : actualPositions.length / 3;
assert.equal(count, raw.getAttribute('position').count);
// Meshopt may rotate a triangle's first corner; winding and every position/normal must match.
for (let i = 0; i < count; i += 3) {
  let matched = false;
  for (let offset = 0; offset < 3 && !matched; offset++) {
    matched = Object.entries(attributes).every(([name, semantic]) => {
      const expected = raw.getAttribute(name).array;
      const actual = semantic === 'POSITION' ? actualPositions : actualNormals;
      for (let corner = 0; corner < 3; corner++) for (let axis = 0; axis < 3; axis++) {
        const v = i + (corner + offset) % 3;
        if (Math.abs(expected[(i + corner) * 3 + axis] - actual[(indices ? indices[v] : v) * 3 + axis]) > 1e-7) return false;
      }
      return true;
    });
  }
  assert.ok(matched, `Triangle ${i / 3} changed`);
}
const pointPrimitive = nodes.find(n => n.getName() === 'r3g-points').getMesh().listPrimitives()[0];
assert.deepEqual(pointPrimitive.getAttribute('POSITION').getArray(), pointGeometry.getAttribute('position').array);
assert.deepEqual(pointPrimitive.getAttribute('_ASEED').getArray(), pointGeometry.getAttribute('aSeed').array);
assert.equal(nodes.filter(n => n.getName().startsWith('contour-')).length, contours.length * 2);
await save('r3g-scene', 'glb', Buffer.from(binary), {
  kind: 'model', contentType: 'model/gltf-binary', compression: 'EXT_meshopt_compression (lossless; MeshoptDecoder required)', uncompressedBytes: exported.byteLength, modelSize,
  originalVertices: raw.getAttribute('position').count,
  vertices: primitive.getAttribute('POSITION').getCount(),
  points: positions.length / 3, contourCount: contours.length,
  validation: 'triangle positions and normals match within 1e-7; point positions and seeds match exactly',
});
const imageFiles = files.filter(f => f.originalBytes);
const manifest = {
  version: 1, cacheControl: 'public, max-age=31536000, immutable', files,
  totals: { files: files.length, bytes: files.reduce((sum, f) => sum + f.bytes, 0), originalImageBytes: imageFiles.reduce((sum, f) => sum + f.originalBytes, 0), optimizedImageBytes: imageFiles.reduce((sum, f) => sum + f.bytes, 0) },
};
await writeFile(`${output}.manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
// Dashboard CORS editor format. This config is outside the upload folder.
await writeFile(`${output}.cors.json`, `${JSON.stringify([{
  AllowedOrigins: ['https://r3actgo.com', 'https://www.r3actgo.com', 'http://127.0.0.1:4175', 'http://localhost:4175', 'http://127.0.0.1:4321', 'http://127.0.0.1:4322'],
  AllowedMethods: ['GET', 'HEAD'], AllowedHeaders: ['*'], ExposeHeaders: ['ETag'], MaxAgeSeconds: 86400,
}], null, 2)}\n`);
console.log(JSON.stringify({ output, ...manifest.totals, fileCount: files.length, files: files.map(({ file, bytes }) => ({ file, bytes })) }, null, 2));
