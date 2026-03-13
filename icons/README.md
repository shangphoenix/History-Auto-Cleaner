# 图标说明

扩展需要以下尺寸的 PNG 图标文件：
- `icon16.png` - 16x16 像素
- `icon48.png` - 48x48 像素
- `icon128.png` - 128x128 像素

## 生成方法

### 方法一：使用 Node.js 脚本

1. 安装依赖：
```bash
npm install sharp
```

2. 运行生成脚本：
```bash
node generate-icons.js
```

### 方法二：在线转换

1. 访问 [Convertio SVG to PNG](https://convertio.co/svg-png/)
2. 上传 `icon.svg`
3. 分别转换为 16x16, 48x48, 128x128 尺寸
4. 下载并放入此目录

### 方法三：手动创建

使用 Photoshop、GIMP 等工具：
1. 打开 `icon.svg`
2. 导出为 PNG 格式
3. 创建三个尺寸版本
4. 按名称保存

## 自定义图标

如果想使用自己的图标，只需替换上述三个文件即可。建议使用渐变色背景配合白色图标的设计。
