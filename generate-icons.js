// 图标生成工具
// 使用 Node.js 和 sharp 库生成 PNG 图标

const fs = require('fs');
const path = require('path');

// 检查是否安装了 sharp
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.log('请先安装 sharp 库：');
  console.log('npm install sharp');
  process.exit(1);
}

const sizes = [16, 48, 128];
const svgPath = path.join(__dirname, 'icons', 'icon.svg');
const outputDir = path.join(__dirname, 'icons');

async function generateIcons() {
  console.log('正在生成图标...\n');
  
  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon${size}.png`);
    
    try {
      await sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      
      console.log(`✓ 生成 ${size}x${size} 图标: ${outputPath}`);
    } catch (e) {
      console.error(`✗ 生成 ${size}x${size} 图标失败:`, e.message);
    }
  }
  
  console.log('\n图标生成完成！');
}

// 检查 SVG 文件是否存在
if (!fs.existsSync(svgPath)) {
  console.error('错误：找不到 SVG 文件:', svgPath);
  process.exit(1);
}

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

generateIcons();
