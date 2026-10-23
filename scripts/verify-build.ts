import { access, readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
const references = new Set<string>([manifest.action.default_popup]);
const iconPaths = new Set<string>();

for (const script of manifest.content_scripts) {
  for (const asset of [...script.js, ...script.css]) references.add(asset);
}

for (const icons of [manifest.icons, manifest.action.default_icon]) {
  for (const [size, asset] of Object.entries(icons as Record<string, string>)) {
    references.add(asset);
    iconPaths.add(asset);
    const png = await readFile(resolve(directory, asset));
    if (
      png.length < 24 ||
      !png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      png.readUInt32BE(16) !== Number(size) ||
      png.readUInt32BE(20) !== Number(size)
    ) {
      throw new Error(`Expected a ${size}x${size} PNG icon: ${asset}`);
    }
  }
}

const popup = await readFile(resolve(directory, manifest.action.default_popup), 'utf8');
for (const match of popup.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const asset = match[1];
  if (!/^(?:[a-z]+:|#|\/\/)/i.test(asset)) references.add(asset);
}

for (const asset of references) {
  const path = resolve(directory, asset.replace(/^\/+/, ''));
  if (!path.startsWith(directory + sep))
    throw new Error(`Asset escapes the build directory: ${asset}`);
  await access(path);
}

console.log(`Verified ${references.size} packaged files and ${iconPaths.size} PNG icon sizes.`);
