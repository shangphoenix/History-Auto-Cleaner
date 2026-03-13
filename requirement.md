# Chrome 扩展需求文档

## 自动清理历史记录 - 阻止地址栏补全

### 1. 产品概述

**名称**: History Auto-Cleaner

**版本**: 1.0.0

**目标**: 通过自动删除特定网站的历史记录，阻止 Chrome 地址栏自动补全这些网站

### 2. 核心功能

#### 2.1 黑白名单机制

- **黑名单**: 匹配规则的网址自动从历史删除
- **白名单**: 优先级高于黑名单，匹配则保留（用于黑名单的例外情况）
- **支持通配符**: `*.example.com` 匹配所有子域名

#### 2.2 匹配规则

| 类型     | 示例                                                     | 说明                                                       |
| :------- | :------------------------------------------------------- | :--------------------------------------------------------- |
| 域名级别 | `example.com`                                            | 匹配该域名下所有页面                                       |
| 通配域名 | `*.example.com`                                          | 匹配所有子域名（如 `mail.example.com`, `www.example.com`） |
| 精确URL  | [`https://example.com/login`](https://example.com/login) | 仅匹配完整URL                                              |

#### 2.3 删除时机（可配置）

- **立即删除**: 页面访问后立即从历史移除（最安全）
- **页面关闭后**: 标签页关闭时删除（当前会话可找回）
- **延迟删除**: 设置 X 分钟后删除

### 3. 技术架构

```
manifest.json (V3)
├── permissions: ["history", "storage", "tabs"]
├── host_permissions: ["<all_urls>"]
└── background: { "service_worker": "background.js" }

background.js
├── 初始化: 加载配置，注册监听器
├── chrome.history.onVisited → URL匹配 → 加入删除队列
├── chrome.tabs.onRemoved → 页面关闭时执行延迟删除
└── chrome.alarms → 延迟删除定时器

options/
├── options.html: 配置界面
├── options.js: 保存/验证配置
└── styles.css: 界面样式
```



### 4. 配置界面功能

**黑名单设置**

- 多行文本框，每行一个规则
- 实时验证规则格式
- 示例: `*.facebook.com`, `twitter.com`, [`https://example.com/private`](https://example.com/private)

**白名单设置**

- 多行文本框
- 格式同黑名单

**删除策略**

- 单选按钮: 立即删除 / 页面关闭后 / 延迟 X 分钟
- 滑块设置延迟时间 (1-60分钟)

**实时预览**

- 显示当前配置会影响的示例URL
- 规则冲突检测（白名单覆盖黑名单的提示）

### 5. 匹配算法伪代码

```
function shouldDelete(url, blacklist, whitelist) {
  // 1. 先检查白名单
  for (rule of whitelist) {
    if (match(url, rule)) return false; // 白名单优先，不删除
  }
  
  // 2. 检查黑名单
  for (rule of blacklist) {
    if (match(url, rule)) return true; // 匹配黑名单，删除
  }
  
  return false; // 默认保留
}

function match(url, rule) {
  if (rule.startsWith('http')) {
    // 精确URL匹配
    return url === rule;
  }
  
  // 域名匹配
  const hostname = new URL(url).hostname;
  if (rule.startsWith('*.')) {
    const domain = rule.slice(2);
    return hostname === domain || hostname.endsWith('.' + domain);
  }
  return hostname === rule || hostname.endsWith('.' + rule);
}
```



### 6. 存储结构

```
{
  "config": {
    "blacklist": ["*.facebook.com", "twitter.com"],
    "whitelist": ["work.facebook.com"],
    "deletionMode": "immediate", // "immediate" | "onClose" | "delayed"
    "delayMinutes": 30
  },
  "pendingDeletions": {
    "tabId_123": ["https://example.com/page1", "timestamp"],
    "tabId_456": ["https://example.com/page2", "timestamp"]
  }
}
```



### 7. 边界情况处理

| 场景           | 处理方式                 |
| :------------- | :----------------------- |
| 隐身模式       | 默认不记录历史，无需处理 |
| chrome:// 页面 | 忽略，不处理内部页面     |
| 扩展页面       | 忽略                     |
| 规则格式错误   | 设置页面红色高亮提示     |
| 重复规则       | 自动去重                 |

### 8. 权限说明

必需权限:

- `history`: 读取和删除历史记录
- `storage`: 存储用户配置
- `tabs`: 监听标签页关闭事件（用于"页面关闭后删除"模式）
- `alarms`: 延迟删除的定时器
- `host_permissions: <all_urls>`: 匹配所有URL