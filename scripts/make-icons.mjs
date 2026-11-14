/**
 * Draws the app icon and saves it as PNG files in public/icons/.
 * Run with: npm run icons
 *
 * The icon: soft charcoal square, a dim ring track and a white ring filled
 * about 70 % (like the calories ring). The ring stays inside the middle 80 %
 * so Android can crop the icon to a circle or squircle ("maskable").
 *
 * No image libraries: we compute each pixel and write the PNG format by hand
 * using Node's built-in zlib.
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const BG = [0x2b, 0x2d, 0x33];    // #2B2D33 soft charcoal
const TRACK = [0x4a, 0x4c, 0x53]; // dim ring track
const RING = [0xff, 0xff, 0xff];  // white progress arc
const FILL = 0.7;                 // 70 % of the ring is filled

function drawIcon(size) {
  const radius = size * 0.26;  // ring centre line
  const stroke = size * 0.075; // ring thickness
  const c = size / 2;
  const endAngle = FILL * 2 * Math.PI;
  // Ends of the arc (for the rounded caps): top, and 70 % clockwise.
  const caps = [
    [c, c - radius],
    [c + radius * Math.sin(endAngle), c - radius * Math.cos(endAngle)],
  ];

  // Which colour is at point (x, y)?
  function colourAt(x, y) {
    const dx = x - c, dy = y - c;
    const dist = Math.hypot(dx, dy);
    const onRing = Math.abs(dist - radius) <= stroke / 2;
    let angle = Math.atan2(dx, -dy); // 0 at the top, clockwise
    if (angle < 0) angle += 2 * Math.PI;
    const onCap = caps.some(([px, py]) => Math.hypot(x - px, y - py) <= stroke / 2);
    if ((onRing && angle <= endAngle) || onCap) return RING;
    if (onRing) return TRACK;
    return BG;
  }

  // 4 × 4 samples per pixel for smooth edges.
  const S = 4;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3); // first byte = PNG filter type 0
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const [cr, cg, cb] = colourAt(x + (sx + 0.5) / S, y + (sy + 0.5) / S);
          r += cr; g += cg; b += cb;
        }
      }
      const n = S * S;
      row[1 + x * 3] = Math.round(r / n);
      row[2 + x * 3] = Math.round(g / n);
      row[3 + x * 3] = Math.round(b / n);
    }
    rows.push(row);
  }
  return encodePng(size, size, Buffer.concat(rows));
}

// ---- Minimal PNG writer (RGB, 8 bits per channel) ----

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG signature
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icons', { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(`public/icons/icon-${size}.png`, drawIcon(size));
  console.log(`public/icons/icon-${size}.png`);
}
