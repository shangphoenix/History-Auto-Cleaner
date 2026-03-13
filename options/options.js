// 默认配置
const DEFAULT_CONFIG = {
  blacklist: [],
  whitelist: [],
  deletionMode: 'immediate',
  delayMinutes: 30
};

// DOM 元素
const elements = {
  blacklist: document.getElementById('blacklist'),
  whitelist: document.getElementById('whitelist'),
  blacklistError: document.getElementById('blacklist-error'),
  whitelistError: document.getElementById('whitelist-error'),
  deletionMode: document.getElementsByName('deletionMode'),
  delayContainer: document.getElementById('delay-container'),
  delayMinutes: document.getElementById('delayMinutes'),
  delayValue: document.getElementById('delay-value'),
  testUrl: document.getElementById('test-url'),
  testBtn: document.getElementById('test-btn'),
  testResult: document.getElementById('test-result'),
  saveBtn: document.getElementById('save-btn'),
  saveStatus: document.getElementById('save-status')
};

// 初始化
async function init() {
  // 加载配置
  const config = await loadConfig();
  
  // 填充表单
  elements.blacklist.value = config.blacklist.join('\n');
  elements.whitelist.value = config.whitelist.join('\n');
  
  // 设置删除模式
  for (const radio of elements.deletionMode) {
    if (radio.value === config.deletionMode) {
      radio.checked = true;
    }
  }
  
  // 设置延迟时间
  elements.delayMinutes.value = config.delayMinutes;
  elements.delayValue.textContent = config.delayMinutes;
  
  // 根据模式显示/隐藏延迟设置
  updateDelayVisibility();
  
  // 绑定事件
  bindEvents();
}

// 加载配置
async function loadConfig() {
  const result = await chrome.storage.local.get('config');
  return result.config || DEFAULT_CONFIG;
}

// 保存配置
async function saveConfig(config) {
  await chrome.storage.local.set({ config });
}

// 绑定事件
function bindEvents() {
  // 删除模式切换
  for (const radio of elements.deletionMode) {
    radio.addEventListener('change', updateDelayVisibility);
  }
  
  // 延迟时间滑块
  elements.delayMinutes.addEventListener('input', (e) => {
    elements.delayValue.textContent = e.target.value;
  });
  
  // 保存按钮
  elements.saveBtn.addEventListener('click', handleSave);
  
  // 测试按钮
  elements.testBtn.addEventListener('click', handleTest);
  
  // 测试输入框回车
  elements.testUrl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleTest();
    }
  });
}

// 更新延迟设置可见性
function updateDelayVisibility() {
  const selectedMode = document.querySelector('input[name="deletionMode"]:checked').value;
  if (selectedMode === 'delayed') {
    elements.delayContainer.classList.remove('hidden');
  } else {
    elements.delayContainer.classList.add('hidden');
  }
}

// 解析规则列表
function parseRules(text) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

// 验证规则
function validateRules(rules, errorElement) {
  errorElement.textContent = '';
  
  for (const rule of rules) {
    // 检查是否为空
    if (!rule) continue;
    
    // 基本格式检查
    if (rule.startsWith('*.')) {
      // 通配域名格式
      const domain = rule.slice(2);
      if (!domain || domain.includes('/') || domain.includes('*')) {
        errorElement.textContent = `无效规则: "${rule}" - 通配域名格式应为 "*.example.com"`;
        return false;
      }
    } else if (rule.startsWith('http')) {
      // URL格式
      try {
        new URL(rule);
      } catch {
        errorElement.textContent = `无效规则: "${rule}" - URL格式不正确`;
        return false;
      }
    } else {
      // 域名格式
      if (rule.includes('/') || rule.includes('*') || rule.includes(' ')) {
        errorElement.textContent = `无效规则: "${rule}" - 域名格式应为 "example.com"`;
        return false;
      }
    }
  }
  
  return true;
}

// 匹配规则（复制自 background.js）
function matchUrl(url, rule) {
  try {
    if (rule.startsWith('http')) {
      return url === rule;
    }
    
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    if (rule.startsWith('*.')) {
      const domain = rule.slice(2);
      return hostname === domain || hostname.endsWith('.' + domain);
    }
    
    return hostname === rule || hostname.endsWith('.' + rule);
  } catch (e) {
    return false;
  }
}

// 检查是否应该删除
function shouldDelete(url, blacklist, whitelist) {
  for (const rule of whitelist) {
    if (matchUrl(url, rule)) {
      return { shouldDelete: false, reason: '匹配白名单规则: ' + rule };
    }
  }
  
  for (const rule of blacklist) {
    if (matchUrl(url, rule)) {
      return { shouldDelete: true, reason: '匹配黑名单规则: ' + rule };
    }
  }
  
  return { shouldDelete: false, reason: '未匹配任何规则' };
}

// 处理保存
async function handleSave() {
  // 清除之前的错误
  elements.blacklistError.textContent = '';
  elements.whitelistError.textContent = '';
  elements.blacklist.classList.remove('error');
  elements.whitelist.classList.remove('error');
  elements.saveStatus.textContent = '';
  elements.saveStatus.className = 'save-status';
  
  // 解析规则
  const blacklist = parseRules(elements.blacklist.value);
  const whitelist = parseRules(elements.whitelist.value);
  
  // 验证规则
  let hasError = false;
  
  if (!validateRules(blacklist, elements.blacklistError)) {
    elements.blacklist.classList.add('error');
    hasError = true;
  }
  
  if (!validateRules(whitelist, elements.whitelistError)) {
    elements.whitelist.classList.add('error');
    hasError = true;
  }
  
  if (hasError) {
    elements.saveStatus.textContent = '请修正规则错误后再保存';
    elements.saveStatus.classList.add('error');
    return;
  }
  
  // 获取删除模式
  const deletionMode = document.querySelector('input[name="deletionMode"]:checked').value;
  const delayMinutes = parseInt(elements.delayMinutes.value);
  
  // 保存配置
  const config = {
    blacklist,
    whitelist,
    deletionMode,
    delayMinutes
  };
  
  try {
    await saveConfig(config);
    elements.saveStatus.textContent = '设置已保存！';
    elements.saveStatus.classList.add('success');
    
    // 3秒后清除状态
    setTimeout(() => {
      elements.saveStatus.textContent = '';
      elements.saveStatus.className = 'save-status';
    }, 3000);
  } catch (e) {
    elements.saveStatus.textContent = '保存失败: ' + e.message;
    elements.saveStatus.classList.add('error');
  }
}

// 处理测试
function handleTest() {
  const url = elements.testUrl.value.trim();
  
  if (!url) {
    showTestResult('请输入要测试的URL', 'error');
    return;
  }
  
  // 验证URL格式
  try {
    new URL(url);
  } catch {
    showTestResult('URL格式不正确', 'error');
    return;
  }
  
  const blacklist = parseRules(elements.blacklist.value);
  const whitelist = parseRules(elements.whitelist.value);
  
  const result = shouldDelete(url, blacklist, whitelist);
  
  if (result.shouldDelete) {
    showTestResult(`✓ 该URL将被删除（${result.reason}）`, 'success');
  } else {
    showTestResult(`✗ 该URL将被保留（${result.reason}）`, 'info');
  }
}

// 显示测试结果
function showTestResult(message, type) {
  elements.testResult.textContent = message;
  elements.testResult.className = 'test-result ' + type;
}

// 启动
init();
