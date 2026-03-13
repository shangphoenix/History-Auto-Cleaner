# Chrome 扩展需求文档

## 自动清理历史记录 + 书签隔离管理

### 1. 产品概述

**名称**: History Auto-Cleaner

**版本**: 1.0.1

**目标**: 
1. 通过自动删除特定网站的历史记录，阻止 Chrome 地址栏自动补全
2. 将匹配黑名单的书签迁移到扩展内部管理，避免出现在地址栏建议中

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

### 3. 书签隔离功能

#### 3.1 功能概述

由于 Chrome 地址栏会从书签中提供补全建议，且无法通过 API 隐藏特定书签，本扩展提供**书签隔离**功能：将匹配黑名单的书签迁移到扩展内部管理。

**特性**:
- 保持原 Chrome 书签的完整文件夹结构
- 隔离后的书签不会出现在 Chrome 地址栏建议中
- 可通过扩展图标弹出面板访问隔离书签
- 支持一键恢复到 Chrome 书签

#### 3.2 自动迁移机制

**触发条件**:
1. **实时迁移**: 用户访问黑名单网站时，如果在 Chrome 书签中 → 自动移入扩展隔离区
2. **启动扫描**: 扩展安装或浏览器启动时，扫描整个书签树 → 批量隔离现有匹配项

**迁移过程**:
```
检测黑名单匹配
    ↓
检查是否在 Chrome 书签中
    ↓
├─ 是 → 复制到扩展隔离区（保持完整路径）
│       ↓
│       从 Chrome 书签删除
│       ↓
│       从历史记录删除
└─ 否 → 仅从历史记录删除
```

#### 3.3 隔离书签管理界面（Popup）

**功能**:
- 🌲 **树形目录浏览**: 保持原 Chrome 书签的文件夹结构
- 🔍 **搜索功能**: 按标题或 URL 搜索隔离书签
- 🔗 **快速访问**: 点击书签直接打开（不会添加到历史记录）
- 🔄 **一键恢复**: 选中书签可恢复回 Chrome 书签
- ➕ **手动添加**: 可手动将当前页面加入隔离书签
- 🗑️ **删除**: 彻底删除隔离书签

**界面布局**:
```
┌─────────────────────────────────────┐
│ 🔍 搜索隔离书签...          [设置] │
├─────────────────────────────────────┤
│ 📁 工作资料                         │
│   ├─ 📄 内部文档                    │
│   └─ 📁 项目A                       │
│       └─ 📄 代码仓库                │
│ 📁 个人收藏                         │
│   └─ 📄 私密网站                    │
├─────────────────────────────────────┤
│ [添加当前页]  [恢复选中]  [删除]    │
└─────────────────────────────────────┘
```

#### 3.4 隔离书签存储结构

```json
{
  "isolatedBookmarks": {
    "folders": [
      {
        "id": "folder_1",
        "title": "工作资料",
        "parentId": null,
        "children": ["folder_2", "bookmark_1"]
      },
      {
        "id": "folder_2", 
        "title": "项目A",
        "parentId": "folder_1",
        "children": ["bookmark_2"]
      }
    ],
    "bookmarks": [
      {
        "id": "bookmark_1",
        "title": "内部文档",
        "url": "https://internal.company.com/docs",
        "parentId": "folder_1",
        "dateAdded": 1234567890
      },
      {
        "id": "bookmark_2",
        "title": "代码仓库",
        "url": "https://gitlab.company.com/project",
        "parentId": "folder_2",
        "dateAdded": 1234567890
      }
    ]
  }
}
```

### 4. 技术架构

```
manifest.json (V3)
├── permissions: ["history", "storage", "tabs", "bookmarks", "alarms", "activeTab"]
├── host_permissions: ["<all_urls>"]
├── background: { "service_worker": "background.js" }
├── action: { "default_popup": "popup.html" }
└── options_page: "options.html"

background.js
├── 初始化
│   ├── 加载配置
│   ├── 注册监听器
│   └── 启动扫描（如果启用）
├── chrome.history.onVisited
│   ├── URL 匹配黑白名单
│   ├── 检查是否在 Chrome 书签中
│   ├── 迁移到隔离区（如匹配）
│   └── 加入删除队列
├── chrome.tabs.onRemoved
│   └── 执行延迟删除
├── chrome.alarms
│   └── 定时删除任务
└── chrome.bookmarks.onCreated
    └── 实时检查并隔离新添加的书签

popup/
├── popup.html: 隔离书签管理界面
├── popup.js: 书签树渲染、搜索、操作逻辑
└── popup.css: 样式

options/
├── options.html: 配置页面
├── options.js: 配置保存/加载
└── styles.css: 样式
```



### 5. 配置界面功能

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

**书签隔离设置**

- ☑️ **启用书签隔离**: 总开关，控制是否自动迁移匹配的书签
- ☑️ **启动时扫描**: 扩展启动时扫描整个书签树并隔离匹配项
- 📊 **隔离书签统计**: 显示当前已隔离的书签数量和文件夹数

### 6. 匹配算法伪代码

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

// 书签树扫描（用于启动扫描）
async function scanBookmarks(node, blacklist, whitelist, isolated = {folders: [], bookmarks: []}) {
  if (node.url) {
    // 是书签
    if (shouldDelete(node.url, blacklist, whitelist)) {
      isolated.bookmarks.push({
        id: node.id,
        title: node.title,
        url: node.url,
        parentId: node.parentId,
        dateAdded: node.dateAdded
      });
    }
  } else if (node.children) {
    // 是文件夹
    const hasIsolatedChildren = node.children.some(child => 
      child.url ? shouldDelete(child.url, blacklist, whitelist) : true
    );
    
    if (hasIsolatedChildren || node.parentId === undefined) {
      isolated.folders.push({
        id: node.id,
        title: node.title,
        parentId: node.parentId,
        children: []
      });
      
      for (const child of node.children) {
        await scanBookmarks(child, blacklist, whitelist, isolated);
      }
    }
  }
  
  return isolated;
}
```



### 7. 存储结构

```json
{
  "config": {
    "blacklist": ["*.facebook.com", "twitter.com"],
    "whitelist": ["work.facebook.com"],
    "deletionMode": "immediate",
    "delayMinutes": 30,
    "bookmarkIsolation": true,
    "scanOnStartup": true
  },
  "isolatedBookmarks": {
    "folders": [
      {
        "id": "folder_1",
        "title": "工作资料",
        "parentId": null,
        "children": ["folder_2", "bookmark_1"]
      },
      {
        "id": "folder_2", 
        "title": "项目A",
        "parentId": "folder_1",
        "children": ["bookmark_2"]
      }
    ],
    "bookmarks": [
      {
        "id": "bookmark_1",
        "title": "内部文档",
        "url": "https://internal.company.com/docs",
        "parentId": "folder_1",
        "dateAdded": 1234567890
      },
      {
        "id": "bookmark_2",
        "title": "代码仓库",
        "url": "https://gitlab.company.com/project",
        "parentId": "folder_2",
        "dateAdded": 1234567890
      }
    ]
  },
  "pendingDeletions": {
    "tabId_123": ["https://example.com/page1", 1234567890],
    "tabId_456": ["https://example.com/page2", 1234567890]
  }
}
```



### 8. 边界情况处理

| 场景                   | 处理方式                           |
| :--------------------- | :--------------------------------- |
| 隐身模式               | 默认不记录历史，无需处理           |
| chrome:// 页面         | 忽略，不处理内部页面               |
| 扩展页面               | 忽略                               |
| 规则格式错误           | 设置页面红色高亮提示               |
| 重复规则               | 自动去重                           |
| 书签重复               | 自动去重，保留最新添加的           |
| Chrome 书签被手动删除  | 保留在隔离区，可手动恢复或删除     |
| 隔离书签损坏           | 启动时验证，提示恢复或重置         |

### 9. 权限说明

必需权限:

| 权限 | 用途 |
|------|------|
| `history` | 读取和删除浏览历史记录 |
| `bookmarks` | 读取、添加、删除书签（用于书签隔离功能） |
| `storage` | 存储用户配置和隔离书签数据 |
| `tabs` | 监听标签页关闭事件（用于"页面关闭后删除"模式） |
| `alarms` | 延迟删除的定时任务 |
| `activeTab` | 获取当前标签页信息（用于手动添加书签到隔离区） |
| `host_permissions: <all_urls>` | 匹配所有 URL 进行规则检查 |