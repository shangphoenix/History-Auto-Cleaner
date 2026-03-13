// 生成简单的 PNG 图标 - 不依赖外部库
const fs = require('fs');
const path = require('path');

// 简单的 PNG 文件头 + IHDR + IDAT + IEND
// 这会生成一个简单的 1x1 像素的彩色方块，然后缩放到指定尺寸

function createPNG(width, height, color) {
  // 将颜色转换为 RGB
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  
  // PNG 签名
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // 创建 IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type (RGB)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  
  const ihdrChunk = createChunk('IHDR', ihdr);
  
  // 创建图像数据（简单的纯色填充）
  const rowSize = 1 + width * 3; // filter byte + RGB data
  const imageData = Buffer.alloc(height * rowSize);
  
  for (let y = 0; y < height; y++) {
    const rowStart = y * rowSize;
    imageData[rowStart] = 0; // filter type: none
    
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowStart + 1 + x * 3;
      imageData[pixelOffset] = r;
      imageData[pixelOffset + 1] = g;
      imageData[pixelOffset + 2] = b;
    }
  }
  
  // 压缩数据（使用 zlib）
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(imageData);
  const idatChunk = createChunk('IDAT', compressed);
  
  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));
  
  // 合并所有部分
  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const chunk = Buffer.alloc(4 + 4 + data.length + 4);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  
  // 计算 CRC
  const crc = require('zlib').crc32(chunk.slice(4, 8 + data.length));
  chunk.writeUInt32BE(crc >>> 0, 8 + data.length);
  
  return chunk;
}

// 生成图标
const iconsDir = path.join(__dirname, 'icons');
const sizes = [16, 48, 128];
const gradientColors = [0x667eea, 0x764ba2]; // 渐变起始和结束色，使用平均值

console.log('正在生成图标...\n');

sizes.forEach(size => {
  const color = 0x667eea; // 使用主题色
  const png = createPNG(size, size, color);
  const outputPath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(outputPath, png);
  console.log(`✓ 生成 ${size}x${size} 图标: icon${size}.png`);
});

console.log('\n图标生成完成！');
console.log('现在可以重新加载扩展程序了。');
