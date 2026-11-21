/* Build the connected harbor surface from a horizontal slice through the full-detail
   terrain and structures. Bridges above the slice leave navigable water below them. */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const folder = path.resolve(__dirname, '../dist/data');
const tiles = JSON.parse(fs.readFileSync(path.join(folder, 'cells.json')));
const size = 2048, origin = -512, spacing = .5;
const level = -40.5; // Approximate shoreline from the official Season 8 dock photograph.
const terrain = new Float32Array(size * size).fill(-Infinity);
const solid = new Uint8Array(size * size);
const index = (x, z) => Math.floor((z - origin) / spacing) * size + Math.floor((x - origin) / spacing);

function fillTriangle(a, b, c, isTerrain) {
  const minX = Math.max(0, Math.ceil(Math.min(a[0], b[0], c[0]) - .5));
  const maxX = Math.min(size - 1, Math.floor(Math.max(a[0], b[0], c[0]) - .5));
  const minZ = Math.max(0, Math.ceil(Math.min(a[2], b[2], c[2]) - .5));
  const maxZ = Math.min(size - 1, Math.floor(Math.max(a[2], b[2], c[2]) - .5));
  const ux = b[0] - a[0], uz = b[2] - a[2], vx = c[0] - a[0], vz = c[2] - a[2];
  const det = ux * vz - uz * vx;
  if (Math.abs(det) < 1e-8) return;
  for (let z = minZ; z <= maxZ; z++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x + .5 - a[0], dz = z + .5 - a[2];
      const u = (dx * vz - dz * vx) / det, v = (ux * dz - uz * dx) / det;
      if (u < 0 || v < 0 || u + v > 1) continue;
      const i = z * size + x;
      if (isTerrain) terrain[i] = Math.max(terrain[i], a[1] + u * (b[1] - a[1]) + v * (c[1] - a[1]));
      else solid[i] = 1;
    }
  }
}

function cutWall(a, b, c) {
  if (Math.min(a[1], b[1], c[1]) > level || Math.max(a[1], b[1], c[1]) < level) return;
  if (Math.max(a[1], b[1], c[1]) - Math.min(a[1], b[1], c[1]) < .001) {
    fillTriangle(a, b, c, false);
    return;
  }
  const contacts = [];
  for (const [p, q] of [[a, b], [b, c], [c, a]]) {
    if ((p[1] > level) === (q[1] > level)) continue;
    const t = (level - p[1]) / (q[1] - p[1]);
    contacts.push([p[0] + t * (q[0] - p[0]), p[2] + t * (q[2] - p[2])]);
  }
  if (contacts.length !== 2) return;
  const [[x, z], [x2, z2]] = contacts, dx = x2 - x, dz = z2 - z;
  const steps = Math.max(1, Math.ceil(2 * Math.max(Math.abs(dx), Math.abs(dz))));
  for (let i = 0; i <= steps; i++) {
    const col = Math.floor(x + dx * i / steps), row = Math.floor(z + dz * i / steps);
    if (col >= 0 && col < size && row >= 0 && row < size) solid[row * size + col] = 1;
  }
}

for (const tile of tiles) {
  const isTerrain = tile.file.endsWith('_1.gz');
  if (!isTerrain && (tile.min[1] > level || tile.max[1] < level)) continue;
  const b = zlib.gunzipSync(fs.readFileSync(path.join(folder, tile.file)));
  const n = b.readUInt32LE(0), count = b.readUInt32LE(4), stride = n > 65535 ? 4 : 2;
  const points = new Array(n);
  for (let i = 0; i < n; i++) {
    const p = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      const value = tile.min[k] + b.readUInt16LE(32 + 6 * i + k * 2) / 65535 * (tile.max[k] - tile.min[k]);
      p[k] = k === 1 ? value : (value - origin) / spacing;
    }
    points[i] = p;
  }
  const start = 32 + n * 7;
  for (let i = 0; i < count; i += 3) {
    const at = start + i * stride;
    const a = points[b.readUIntLE(at, stride)], c = points[b.readUIntLE(at + stride, stride)], d = points[b.readUIntLE(at + stride * 2, stride)];
    if (isTerrain) fillTriangle(a, c, d, true);
    else cutWall(a, c, d);
  }
}

const wet = new Uint8Array(size * size), queue = new Uint32Array(wet.length);
let head = 0, tail = 0;
function visit(i) {
  if (wet[i] || solid[i] || !Number.isFinite(terrain[i]) || terrain[i] >= level) return;
  wet[i] = 255;
  queue[tail++] = i;
}
visit(index(-75, 165));
if (!tail) throw Error('Dock water seed falls outside the harbor');
while (head < tail) {
  const i = queue[head++], x = i % size;
  if (i >= size) visit(i - size);
  if (i < wet.length - size) visit(i + size);
  if (x > 0) visit(i - 1);
  if (x < size - 1) visit(i + 1);
}
const header = Buffer.alloc(16);
header.writeUInt32LE(size);header.writeFloatLE(origin, 4);header.writeFloatLE(spacing, 8);header.writeFloatLE(level, 12);
fs.writeFileSync(path.join(folder, 'water.gz'), zlib.gzipSync(Buffer.concat([header, wet]), {level: 9}));
console.log('Harbor surface:', tail * spacing * spacing, 'square meters');
