# History Auto-Cleaner

自动清理历史记录，阻止 Chrome 地址栏补全特定网站。

## 功能特性

- **黑白名单机制**: 精确控制哪些网站的历史记录需要删除
- **通配符支持**: `*.example.com` 匹配所有子域名
- **多种删除策略**: 立即删除 / 页面关闭后 / 延迟删除
- **规则实时测试**: 配置界面可测试URL匹配规则

## 安装方法

### 方法一：开发者模式安装

1. 打开 Chrome 浏览器，访问 `chrome://extensions/`
2. 开启右上角的"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择此文件夹
5. 扩展程序将自动安装

### 方法二：Chrome Web Store（待发布）

## 使用方法

1. 点击 Chrome 工具栏上的扩展图标
2. 在配置界面中添加黑名单规则
3. 选择删除策略
4. 保存设置

### 规则格式

- `example.com` - 匹配该域名下所有页面
- `*.example.com` - 匹配所有子域名（如 `mail.example.com`）
- `https://example.com/login` - 仅匹配完整URL

### 删除策略

1. **立即删除**: 页面访问后立即从历史移除（最安全）
2. **页面关闭后**: 标签页关闭时删除（当前会话可找回）
3. **延迟删除**: 设置 X 分钟后删除

## 图标说明

扩展需要以下尺寸的 PNG 图标：
- `icons/icon16.png` - 16x16 像素
- `icons/icon48.png` - 48x48 像素
- `icons/icon128.png` - 128x128 像素

可以使用 `icons/icon.svg` 作为模板，通过在线转换工具生成 PNG 图标。

### 在线转换工具

1. 访问 [SVG to PNG](https://cloudconvert.com/svg-to-png)
2. 上传 `icons/icon.svg`
3. 分别转换为 16x16, 48x48, 128x128 尺寸
4. 保存到 `icons/` 目录

## 技术架构

- **Manifest V3**: Chrome 扩展最新版本
- **Service Worker**: 后台脚本处理历史记录删除
- **Storage API**: 本地存储用户配置
- **History API**: 读取和删除浏览历史

## 权限说明

扩展需要以下权限：

- `history`: 读取和删除历史记录
- `storage`: 存储用户配置
- `tabs`: 监听标签页关闭事件
- `alarms`: 延迟删除的定时器
- `host_permissions`: 匹配所有URL

## 开发

### 项目结构

```
├── manifest.json      # 扩展配置
├── background.js      # 后台脚本
├── options/           # 配置界面
│   ├── options.html
│   ├── options.js
│   └── styles.css
├── icons/             # 图标文件
│   └── icon.svg
└── requirement.md     # 需求文档
```

### 调试

1. 打开 `chrome://extensions/`
2. 找到 History Auto-Cleaner
3. 点击"背景页"查看后台脚本日志
4. 右键扩展图标选择"检查弹出内容"调试配置界面

## 注意事项

- 隐身模式下访问的网站不会被记录到历史，无需处理
- `chrome://` 和 `chrome-extension://` 页面会被自动忽略
- 白名单优先级高于黑名单
- 规则支持自动去重

## License

MIT
