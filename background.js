// 默认配置
const DEFAULT_CONFIG = {
  blacklist: [],
  whitelist: [],
  deletionMode: 'immediate', // 'immediate' | 'onClose' | 'delayed'
  delayMinutes: 30,
  bookmarkIsolation: true,
  scanOnStartup: true
};

// 默认隔离书签数据结构
const DEFAULT_ISOLATED_BOOKMARKS = {
  folders: [],
  bookmarks: []
};

// 存储键名
const STORAGE_KEYS = {
  config: 'config',
  pendingDeletions: 'pendingDeletions',
  isolatedBookmarks: 'isolatedBookmarks'
};

// 获取配置
async function getConfig() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.config);
  return result[STORAGE_KEYS.config] || DEFAULT_CONFIG;
}

// 保存配置
async function saveConfig(config) {
  await chrome.storage.local.set({ [STORAGE_KEYS.config]: config });
}

// 获取待删除列表
async function getPendingDeletions() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.pendingDeletions);
  return result[STORAGE_KEYS.pendingDeletions] || {};
}

// 保存待删除列表
async function savePendingDeletions(pending) {
  await chrome.storage.local.set({ [STORAGE_KEYS.pendingDeletions]: pending });
}

// 获取隔离书签
async function getIsolatedBookmarks() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.isolatedBookmarks);
  return result[STORAGE_KEYS.isolatedBookmarks] || DEFAULT_ISOLATED_BOOKMARKS;
}

// 保存隔离书签
async function saveIsolatedBookmarks(bookmarks) {
  await chrome.storage.local.set({ [STORAGE_KEYS.isolatedBookmarks]: bookmarks });
}

// 匹配规则
function matchUrl(url, rule) {
  try {
    if (rule.startsWith('http')) {
      // 精确URL匹配
      return url === rule;
    }
    
    // 域名匹配
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // 忽略 chrome:// 和扩展页面
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
      return false;
    }
    
    if (rule.startsWith('*.')) {
      const domain = rule.slice(2);
      return hostname === domain || hostname.endsWith('.' + domain);
    }
    
    return hostname === rule || hostname.endsWith('.' + rule);
  } catch (e) {
    console.error('URL匹配错误:', e);
    return false;
  }
}

// 检查是否应该删除
function shouldDelete(url, blacklist, whitelist) {
  // 1. 先检查白名单
  for (const rule of whitelist) {
    if (matchUrl(url, rule.trim())) {
      return false; // 白名单优先，不删除
    }
  }
  
  // 2. 检查黑名单
  for (const rule of blacklist) {
    if (matchUrl(url, rule.trim())) {
      return true; // 匹配黑名单，删除
    }
  }
  
  return false; // 默认保留
}

// 从历史记录中删除
async function deleteFromHistory(url) {
  try {
    await chrome.history.deleteUrl({ url });
    console.log('已从历史记录删除:', url);
  } catch (e) {
    console.error('删除历史记录失败:', e);
  }
}

// 检查书签是否已存在（去重）
function bookmarkExists(isolatedBookmarks, url, excludeId = null) {
  return isolatedBookmarks.bookmarks.some(bm => 
    bm.url === url && bm.id !== excludeId
  );
}

// 生成唯一ID
function generateId(prefix = '') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 隔离书签 - 将书签添加到隔离区
async function isolateBookmark(bookmarkNode, folderChain = []) {
  const config = await getConfig();
  if (!config.bookmarkIsolation) return null;
  
  const isolatedBookmarks = await getIsolatedBookmarks();
  
  // 检查是否已存在
  if (bookmarkExists(isolatedBookmarks, bookmarkNode.url)) {
    console.log('书签已存在于隔离区:', bookmarkNode.url);
    return null;
  }
  
  // 创建文件夹结构
  let currentParentId = null;
  
  for (const folderName of folderChain) {
    // 查找或创建文件夹
    let folder = isolatedBookmarks.folders.find(f => 
      f.title === folderName && f.parentId === currentParentId
    );
    
    if (!folder) {
      folder = {
        id: generateId('folder'),
        title: folderName,
        parentId: currentParentId,
        children: []
      };
      isolatedBookmarks.folders.push(folder);
    }
    
    currentParentId = folder.id;
  }
  
  // 创建书签
  const newBookmark = {
    id: generateId('bookmark'),
    title: bookmarkNode.title,
    url: bookmarkNode.url,
    parentId: currentParentId,
    dateAdded: bookmarkNode.dateAdded || Date.now()
  };
  
  isolatedBookmarks.bookmarks.push(newBookmark);
  
  // 更新父文件夹的children
  if (currentParentId) {
    const parentFolder = isolatedBookmarks.folders.find(f => f.id === currentParentId);
    if (parentFolder) {
      parentFolder.children.push(newBookmark.id);
    }
  }
  
  await saveIsolatedBookmarks(isolatedBookmarks);
  console.log('书签已隔离:', bookmarkNode.title, bookmarkNode.url);
  
  return newBookmark;
}

// 从Chrome书签中删除
async function deleteFromChromeBookmarks(bookmarkId) {
  try {
    await chrome.bookmarks.remove(bookmarkId);
    console.log('已从Chrome书签删除:', bookmarkId);
    return true;
  } catch (e) {
    console.error('从Chrome书签删除失败:', e);
    return false;
  }
}

// 获取书签的文件夹路径
async function getBookmarkFolderChain(bookmarkId) {
  const chain = [];
  let currentId = bookmarkId;
  
  while (currentId) {
    try {
      const [node] = await chrome.bookmarks.get(currentId);
      if (!node) break;
      
      if (node.parentId && node.parentId !== '0') {
        const [parent] = await chrome.bookmarks.get(node.parentId);
        if (parent && parent.title) {
          chain.unshift(parent.title);
        }
        currentId = node.parentId;
      } else {
        break;
      }
    } catch (e) {
      break;
    }
  }
  
  return chain;
}

// 检查URL是否在Chrome书签中
async function isInChromeBookmarks(url) {
  try {
    const bookmarks = await chrome.bookmarks.search({ url });
    return bookmarks.length > 0 ? bookmarks[0] : null;
  } catch (e) {
    console.error('搜索Chrome书签失败:', e);
    return null;
  }
}

// 扫描并隔离书签（递归）
async function scanAndIsolateBookmarks(node, blacklist, whitelist, folderChain = []) {
  const config = await getConfig();
  if (!config.bookmarkIsolation) return;
  
  if (node.url) {
    // 是书签
    if (shouldDelete(node.url, blacklist, whitelist)) {
      // 获取文件夹路径
      const fullChain = [...folderChain];
      
      // 隔离书签
      await isolateBookmark(node, fullChain);
      
      // 从Chrome书签删除
      await deleteFromChromeBookmarks(node.id);
      
      // 从历史记录删除
      await deleteFromHistory(node.url);
    }
  } else if (node.children) {
    // 是文件夹
    const newChain = node.title ? [...folderChain, node.title] : folderChain;
    
    for (const child of node.children) {
      await scanAndIsolateBookmarks(child, blacklist, whitelist, newChain);
    }
  }
}

// 启动时扫描所有书签
async function scanAllBookmarksOnStartup() {
  const config = await getConfig();
  if (!config.bookmarkIsolation || !config.scanOnStartup) return;
  
  console.log('启动时扫描书签...');
  
  try {
    const tree = await chrome.bookmarks.getTree();
    for (const root of tree) {
      await scanAndIsolateBookmarks(root, config.blacklist, config.whitelist);
    }
    console.log('书签扫描完成');
  } catch (e) {
    console.error('扫描书签失败:', e);
  }
}

// 处理访问事件
async function handleVisited(historyItem) {
  const url = historyItem.url;
  
  // 忽略内部页面
  if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
    return;
  }
  
  const config = await getConfig();
  
  if (!shouldDelete(url, config.blacklist, config.whitelist)) {
    return;
  }
  
  // 检查是否在Chrome书签中，如果在则隔离
  const chromeBookmark = await isInChromeBookmarks(url);
  if (chromeBookmark && config.bookmarkIsolation) {
    const folderChain = await getBookmarkFolderChain(chromeBookmark.id);
    await isolateBookmark(chromeBookmark, folderChain);
    await deleteFromChromeBookmarks(chromeBookmark.id);
  }
  
  switch (config.deletionMode) {
    case 'immediate':
      await deleteFromHistory(url);
      break;
      
    case 'onClose':
      // 获取当前标签页ID并保存到待删除列表
      const tabs = await chrome.tabs.query({ url });
      const pending = await getPendingDeletions();
      for (const tab of tabs) {
        pending[tab.id] = { url, timestamp: Date.now() };
      }
      await savePendingDeletions(pending);
      break;
      
    case 'delayed':
      // 创建延迟删除的闹钟
      const alarmName = `delete_${url}`;
      await chrome.alarms.create(alarmName, {
        delayInMinutes: config.delayMinutes
      });
      // 保存URL到闹钟数据
      await chrome.storage.local.set({ [alarmName]: url });
      console.log(`已设置 ${config.delayMinutes} 分钟后删除:`, url);
      break;
  }
}

// 监听历史记录访问
chrome.history.onVisited.addListener(handleVisited);

// 监听标签页关闭（用于 onClose 模式）
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  const pending = await getPendingDeletions();
  
  if (pending[tabId]) {
    const { url } = pending[tabId];
    await deleteFromHistory(url);
    delete pending[tabId];
    await savePendingDeletions(pending);
  }
});

// 监听闹钟（用于 delayed 模式）
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith('delete_')) {
    const result = await chrome.storage.local.get(alarm.name);
    const url = result[alarm.name];
    
    if (url) {
      await deleteFromHistory(url);
      await chrome.storage.local.remove(alarm.name);
    }
  }
});

// 监听新书签创建（实时隔离）
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  const config = await getConfig();
  if (!config.bookmarkIsolation) return;
  
  if (bookmark.url && shouldDelete(bookmark.url, config.blacklist, config.whitelist)) {
    const folderChain = await getBookmarkFolderChain(id);
    await isolateBookmark(bookmark, folderChain);
    await deleteFromChromeBookmarks(id);
    await deleteFromHistory(bookmark.url);
  }
});

// 消息处理（与popup通信）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        case 'getIsolatedBookmarks':
          const bookmarks = await getIsolatedBookmarks();
          sendResponse({ success: true, data: bookmarks });
          break;
          
        case 'saveIsolatedBookmarks':
          await saveIsolatedBookmarks(request.data);
          sendResponse({ success: true });
          break;
          
        case 'restoreBookmark':
          await restoreBookmarkToChrome(request.bookmarkId);
          sendResponse({ success: true });
          break;
          
        case 'deleteIsolatedBookmark':
          await deleteIsolatedBookmark(request.bookmarkId);
          sendResponse({ success: true });
          break;
          
        case 'addCurrentPage':
          if (request.tabData) {
            await addCurrentPageToIsolated(request.tabData);
          } else if (sender.tab) {
            await addCurrentPageToIsolated(sender.tab);
          } else {
            throw new Error('无法获取当前页面信息');
          }
          sendResponse({ success: true });
          break;
          
        case 'getConfig':
          const config = await getConfig();
          sendResponse({ success: true, data: config });
          break;
          
        default:
          sendResponse({ success: false, error: '未知操作' });
      }
    } catch (error) {
      console.error('消息处理错误:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();
  
  return true; // 保持消息通道开放
});

// 恢复书签到Chrome书签
async function restoreBookmarkToChrome(bookmarkId) {
  const isolatedBookmarks = await getIsolatedBookmarks();
  const bookmark = isolatedBookmarks.bookmarks.find(bm => bm.id === bookmarkId);
  
  if (!bookmark) {
    throw new Error('书签不存在');
  }
  
  try {
    // 创建到Chrome书签
    await chrome.bookmarks.create({
      title: bookmark.title,
      url: bookmark.url
    });
    
    // 从隔离区删除
    await deleteIsolatedBookmark(bookmarkId);
    
    console.log('书签已恢复到Chrome:', bookmark.title);
  } catch (e) {
    console.error('恢复书签失败:', e);
    throw e;
  }
}

// 从隔离区删除书签
async function deleteIsolatedBookmark(bookmarkId) {
  const isolatedBookmarks = await getIsolatedBookmarks();
  
  // 删除书签
  isolatedBookmarks.bookmarks = isolatedBookmarks.bookmarks.filter(
    bm => bm.id !== bookmarkId
  );
  
  // 从父文件夹的children中移除
  for (const folder of isolatedBookmarks.folders) {
    folder.children = folder.children.filter(id => id !== bookmarkId);
  }
  
  await saveIsolatedBookmarks(isolatedBookmarks);
  console.log('书签已从隔离区删除:', bookmarkId);
}

// 将当前页面添加到隔离区
async function addCurrentPageToIsolated(tabData) {
  if (!tabData || !tabData.url) {
    throw new Error('无法获取当前页面信息');
  }

  const bookmarkNode = {
    title: tabData.title || tabData.url,
    url: tabData.url,
    dateAdded: Date.now()
  };

  await isolateBookmark(bookmarkNode, []);

  // 也从历史记录删除
  await deleteFromHistory(tabData.url);

  // 如果在Chrome书签中，也删除
  const chromeBookmark = await isInChromeBookmarks(tabData.url);
  if (chromeBookmark) {
    await deleteFromChromeBookmarks(chromeBookmark.id);
  }
}

// 初始化
chrome.runtime.onInstalled.addListener(async () => {
  const config = await getConfig();
  if (!config.blacklist) {
    await saveConfig(DEFAULT_CONFIG);
  }
  
  // 初始化隔离书签存储
  const isolated = await getIsolatedBookmarks();
  if (!isolated.folders) {
    await saveIsolatedBookmarks(DEFAULT_ISOLATED_BOOKMARKS);
  }
  
  console.log('History Auto-Cleaner 已安装');
  
  // 启动时扫描
  await scanAllBookmarksOnStartup();
});

// 浏览器启动时扫描
chrome.runtime.onStartup.addListener(async () => {
  console.log('浏览器启动，开始扫描书签...');
  await scanAllBookmarksOnStartup();
});

// 导出函数供测试使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    matchUrl,
    shouldDelete,
    getConfig,
    saveConfig,
    getIsolatedBookmarks,
    saveIsolatedBookmarks,
    isolateBookmark,
    restoreBookmarkToChrome,
    deleteIsolatedBookmark
  };
}