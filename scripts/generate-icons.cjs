const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 implementation for PNG chunks
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function generateIconPNG(size, isMaskable = false) {
  // Create RGBA image buffer (size x size)
  const width = size;
  const height = size;
  const rawData = Buffer.alloc(height * (1 + width * 4));

  const cx = width / 2;
  const cy = height / 2;
  const scale = (size / 512) * (isMaskable ? 0.72 : 0.88);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    rawData[rowOffset] = 0; // PNG filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;

      // Coordinate relative to center
      const dx = (x - cx) / scale;
      const dy = (y - cy) / scale;

      // Base background: #090d16
      let r = 9;
      let g = 13;
      let b = 22;
      let a = 255;

      // Distance from center for rounded container or maskable padding
      const maxDist = Math.max(Math.abs(dx), Math.abs(dy));
      if (!isMaskable && maxDist > 220) {
        // Outside rounded icon bounding shape if not maskable
        const cornerDist = Math.hypot(Math.abs(dx) - 160, Math.abs(dy) - 160);
        if (Math.abs(dx) > 160 && Math.abs(dy) > 160 && cornerDist > 60) {
          a = 0;
        }
      }

      if (a > 0) {
        // Draw 3D Isometric Cube geometry
        // Top face: vertices (0, -110), (105, -50), (0, 10), (-105, -50)
        // Check if inside isometric diamond
        const isoX = dx;
        const isoY = dy + 30; // shift slightly
        const topDistX = Math.abs(isoX) / 105;
        const topDistY = Math.abs(isoY + 50) / 60;

        if (dy < -20 && topDistX + topDistY <= 1.0) {
          // Top face: bright sky blue gradient (#38bdf8 to #0284c7)
          const grad = (dy + 110) / 90;
          r = Math.round(56 - grad * 54);
          g = Math.round(189 - grad * 57);
          b = Math.round(248 - grad * 49);
        } else if (dx < 0 && dx >= -105 && dy >= -50 && dy <= 95) {
          // Left face
          const leftSlope1 = -50 + (dx + 105) * (60 / 105);
          const leftSlope2 = leftSlope1 + 85;
          if (dy >= leftSlope1 && dy <= leftSlope2) {
            // Left face: cobalt cyan gradient (#0369a1 to #0c4a6e)
            const grad = (dy + 50) / 145;
            r = Math.round(3 + grad * 9);
            g = Math.round(105 - grad * 31);
            b = Math.round(161 - grad * 51);
          }
        } else if (dx >= 0 && dx <= 105 && dy >= -50 && dy <= 95) {
          // Right face
          const rightSlope1 = -50 + (105 - dx) * (60 / 105);
          const rightSlope2 = rightSlope1 + 85;
          if (dy >= rightSlope1 && dy <= rightSlope2) {
            // Right face: cyan blue gradient (#0284c7 to #075985)
            const grad = (dy + 50) / 145;
            r = Math.round(2 + grad * 5);
            g = Math.round(132 - grad * 43);
            b = Math.round(199 - grad * 66);
          }
        }
      }

      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  // PNG Header
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits per channel
  ihdr[9] = 6; // RGBA color
  ihdr[10] = 0; // compression method 0
  ihdr[11] = 0; // filter method 0
  ihdr[12] = 0; // no interlace

  const ihdrChunk = createChunk('IHDR', ihdr);
  const compressedData = zlib.deflateSync(rawData, { level: 9 });
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = path.resolve(__dirname, '../public');
fs.mkdirSync(publicDir, { recursive: true });

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), generateIconPNG(192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), generateIconPNG(512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), generateIconPNG(512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), generateIconPNG(180, false));

console.log('PWA icons generated successfully in public/');
