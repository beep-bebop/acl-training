// 一次性脚本：生成 PWA 图标（纯 Node 光栅化 + 最小 PNG 编码器，无第三方依赖）
// 图形语言：深色圆角底 + 三根上升的荧光绿柱条（训练进度/渐进负荷）。
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// 带符号距离场：圆角矩形
function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(ox, oy) - r;
}

function smooth(alpha, d, aa) {
  return alpha * Math.min(1, Math.max(0, 0.5 - d / aa));
}

function mix(dst, i, r, g, b, a) {
  const dr = dst[i], dg = dst[i + 1], db = dst[i + 2];
  dst[i] = Math.round(r * a + dr * (1 - a));
  dst[i + 1] = Math.round(g * a + dg * (1 - a));
  dst[i + 2] = Math.round(b * a + db * (1 - a));
  dst[i + 3] = Math.max(dst[i + 3], Math.round(a * 255));
}

function render(size, { margin = 0.18, transparentBg = false } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const S = size;
  const AA = Math.max(1.5, S / 220);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const px = x + 0.5, py = y + 0.5;
      if (!transparentBg) {
        // 深色渐变圆角底
        const bgA = smooth(1, sdRoundRect(px, py, S / 2, S / 2, S / 2 - 0.5, S / 2 - 0.5, S * 0.225), AA);
        if (bgA > 0) {
          const t = py / S;
          const r = Math.round(11 + t * 5), g = Math.round(14 + t * 6), b = Math.round(19 + t * 9);
          mix(buf, i, r, g, b, bgA);
        }
      }
      // 三根上升柱条（占位区域按 margin 收缩，maskable 需更大留白）
      const inner = S * (1 - margin * 2);
      const bw = inner * 0.17, gap = inner * 0.075;
      const totalW = bw * 3 + gap * 2;
      const x0 = (S - totalW) / 2;
      const heights = [inner * 0.42, inner * 0.62, inner * 0.86];
      const colors = [[107, 163, 63], [143, 204, 74], [180, 243, 77]];
      const baseY = S / 2 + inner * 0.43;
      for (let k = 0; k < 3; k++) {
        const cx = x0 + bw / 2 + k * (bw + gap);
        const hh = heights[k] / 2;
        const cy = baseY - hh;
        const d = sdRoundRect(px, py, cx, cy, bw / 2 - 0.5, hh - 0.5, Math.min(bw * 0.28, hh));
        const a = smooth(1, d, AA);
        if (a > 0) mix(buf, i, colors[k][0], colors[k][1], colors[k][2], a);
      }
    }
  }
  return encodePng(S, buf);
}

mkdirSync(join(root, 'public/icons'), { recursive: true });
writeFileSync(join(root, 'public/icons/icon-192.png'), render(192));
writeFileSync(join(root, 'public/icons/icon-512.png'), render(512));
writeFileSync(join(root, 'public/icons/maskable-512.png'), render(512, { margin: 0.26 }));
writeFileSync(join(root, 'public/icons/apple-touch-icon.png'), render(180, { margin: 0.1 }));
writeFileSync(join(root, 'public/icons/favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0B0E13"/><rect x="12" y="34" width="9" height="18" rx="3" fill="#6BA33F"/><rect x="27.5" y="26" width="9" height="26" rx="3" fill="#8FCC4A"/><rect x="43" y="16" width="9" height="36" rx="3" fill="#B4F34D"/></svg>`);
console.log('已生成 public/icons/（icon-192/512、maskable-512、apple-touch-icon、favicon.svg）');
