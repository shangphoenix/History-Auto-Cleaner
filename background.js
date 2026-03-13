// 默认配置
const DEFAULT_CONFIG = {
  blacklist: [],
  whitelist: [],
  deletionMode: 'immediate', // 'immediate' | 'onClose' | 'delayed'
  delayMinutes: 30
};

// 存储键名
const STORAGE_KEYS = {
  config: 'config',
  pendingDeletions: 'pendingDeletions'
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

// 初始化
chrome.runtime.onInstalled.addListener(async () => {
  const config = await getConfig();
  if (!config.blacklist) {
    await saveConfig(DEFAULT_CONFIG);
  }
  console.log('History Auto-Cleaner 已安装');
});

// 导出函数供测试使用（如果需要）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    matchUrl,
    shouldDelete,
    getConfig,
    saveConfig
  };
}
