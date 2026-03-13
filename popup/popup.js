// 向 background service worker 发送消息，自动重试一次（应对 SW 休眠未唤醒的情况）
async function sendMessageWithRetry(message, maxRetries = 3, delayMs = 300) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (e) {
      const isConnectionError = e.message && (
        e.message.includes('Could not establish connection') ||
        e.message.includes('Receiving end does not exist')
      );
      if (isConnectionError && attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      throw e;
    }
  }
}

// 隔离书签管理器
class BookmarkManager {
  constructor() {
    this.isolatedBookmarks = { folders: [], bookmarks: [] };
    this.selectedItems = new Set();
    this.expandedFolders = new Set();
    this.searchQuery = '';
    this.draggedItem = null;
    
    this.init();
  }

  async init() {
    await this.loadBookmarks();
    this.bindEvents();
    this.render();
  }

  // 加载隔离书签
  async loadBookmarks() {
    try {
      const result = await chrome.storage.local.get('isolatedBookmarks');
      this.isolatedBookmarks = result.isolatedBookmarks || { folders: [], bookmarks: [] };
    } catch (e) {
      console.error('加载隔离书签失败:', e);
      this.showNotification('加载书签失败', 'error');
    }
  }

  // 保存隔离书签
  async saveBookmarks() {
    try {
      await chrome.storage.local.set({ isolatedBookmarks: this.isolatedBookmarks });
    } catch (e) {
      console.error('保存隔离书签失败:', e);
      this.showNotification('保存失败', 'error');
    }
  }

  // 绑定事件
  bindEvents() {
    // 搜索
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      this.render();
    });

    // 添加当前页
    document.getElementById('add-current-btn').addEventListener('click', () => this.addCurrentPage());

    // 恢复选中
    document.getElementById('restore-btn').addEventListener('click', () => this.restoreSelected());

    // 删除选中
    document.getElementById('delete-btn').addEventListener('click', () => this.deleteSelected());

    // 设置按钮
    document.getElementById('settings-btn').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    // 确认对话框
    document.getElementById('confirm-cancel').addEventListener('click', () => this.hideConfirm());
    document.getElementById('confirm-ok').addEventListener('click', () => this.confirmAction());

    // 点击空白处关闭对话框
    document.getElementById('confirm-dialog').addEventListener('click', (e) => {
      if (e.target.id === 'confirm-dialog') this.hideConfirm();
    });
  }

  // 渲染书签树
  render() {
    const container = document.getElementById('bookmark-tree');
    const emptyState = document.getElementById('empty-state');
    
    // 过滤书签
    const filteredBookmarks = this.filterBookmarks();
    
    if (filteredBookmarks.length === 0 && this.isolatedBookmarks.bookmarks.length === 0) {
      container.innerHTML = '';
      emptyState.classList.remove('hidden');
      this.updateSelectionInfo();
      return;
    }
    
    emptyState.classList.add('hidden');
    
    // 构建树结构
    const treeData = this.buildTree(filteredBookmarks);
    container.innerHTML = '';
    
    // 渲染节点
    treeData.forEach(node => {
      this.renderNode(container, node, 0);
    });
    
    this.updateSelectionInfo();
  }

  // 过滤书签
  filterBookmarks() {
    if (!this.searchQuery) {
      return this.isolatedBookmarks.bookmarks;
    }
    
    return this.isolatedBookmarks.bookmarks.filter(bm => {
      const titleMatch = bm.title.toLowerCase().includes(this.searchQuery);
      const urlMatch = bm.url.toLowerCase().includes(this.searchQuery);
      return titleMatch || urlMatch;
    });
  }

  // 构建树结构
  buildTree(bookmarks) {
    const folders = this.isolatedBookmarks.folders || [];
    const folderMap = new Map();
    const rootNodes = [];
    
    // 创建文件夹映射
    folders.forEach(folder => {
      folderMap.set(folder.id, {
        ...folder,
        type: 'folder',
        children: []
      });
    });
    
    // 组织文件夹层级
    folders.forEach(folder => {
      const node = folderMap.get(folder.id);
      if (folder.parentId && folderMap.has(folder.parentId)) {
        folderMap.get(folder.parentId).children.push(node);
      } else {
        rootNodes.push(node);
      }
    });
    
    // 添加书签到对应的文件夹
    bookmarks.forEach(bookmark => {
      const bookmarkNode = { ...bookmark, type: 'bookmark' };
      if (bookmark.parentId && folderMap.has(bookmark.parentId)) {
        folderMap.get(bookmark.parentId).children.push(bookmarkNode);
      } else {
        rootNodes.push(bookmarkNode);
      }
    });
    
    return rootNodes;
  }

  // 渲染单个节点
  renderNode(container, node, depth) {
    const isFolder = node.type === 'folder';
    const isExpanded = this.expandedFolders.has(node.id);
    const isSelected = this.selectedItems.has(node.id);
    
    const item = document.createElement('div');
    item.className = `tree-item ${isFolder ? 'folder-item' : ''} ${isSelected ? 'selected' : ''}`;
    item.dataset.id = node.id;
    item.dataset.type = node.type;
    
    // 缩进
    const indent = document.createElement('div');
    indent.className = 'tree-item-indent';
    indent.style.width = `${depth * 20}px`;
    item.appendChild(indent);
    
    // 展开/折叠按钮（仅文件夹）
    if (isFolder) {
      const toggle = document.createElement('div');
      toggle.className = `tree-item-toggle ${isExpanded ? 'expanded' : ''}`;
      toggle.innerHTML = node.children && node.children.length > 0 ? '▶' : '';
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFolder(node.id);
      });
      item.appendChild(toggle);
    } else {
      const spacer = document.createElement('div');
      spacer.className = 'tree-item-toggle';
      item.appendChild(spacer);
    }
    
    // 复选框
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'tree-item-checkbox';
    checkbox.checked = isSelected;
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      this.toggleSelection(node.id);
    });
    item.appendChild(checkbox);
    
    // 图标
    const icon = document.createElement('div');
    icon.className = 'tree-item-icon';
    icon.textContent = isFolder ? (isExpanded ? '📂' : '📁') : '📄';
    item.appendChild(icon);
    
    // 内容
    const content = document.createElement('div');
    content.className = 'tree-item-content';
    
    const title = document.createElement('div');
    title.className = 'tree-item-title';
    title.textContent = node.title || '(无标题)';
    content.appendChild(title);
    
    if (!isFolder && node.url) {
      const url = document.createElement('div');
      url.className = 'tree-item-url';
      url.textContent = node.url;
      content.appendChild(url);
    }
    
    item.appendChild(content);
    
    // 点击打开书签或切换选择
    item.addEventListener('click', (e) => {
      if (e.target.type !== 'checkbox') {
        if (isFolder) {
          this.toggleFolder(node.id);
        } else {
          this.openBookmark(node.url);
        }
      }
    });
    
    // 拖拽事件
    if (!isFolder) {
      item.draggable = true;
      item.addEventListener('dragstart', (e) => this.handleDragStart(e, node));
      item.addEventListener('dragend', (e) => this.handleDragEnd(e));
    }
    
    if (isFolder) {
      item.addEventListener('dragover', (e) => this.handleDragOver(e, node));
      item.addEventListener('drop', (e) => this.handleDrop(e, node));
      item.addEventListener('dragleave', (e) => this.handleDragLeave(e));
    }
    
    container.appendChild(item);
    
    // 递归渲染子节点
    if (isFolder && isExpanded && node.children) {
      node.children.forEach(child => {
        this.renderNode(container, child, depth + 1);
      });
    }
  }

  // 切换文件夹展开状态
  toggleFolder(folderId) {
    if (this.expandedFolders.has(folderId)) {
      this.expandedFolders.delete(folderId);
    } else {
      this.expandedFolders.add(folderId);
    }
    this.render();
  }

  // 切换选择状态
  toggleSelection(itemId) {
    if (this.selectedItems.has(itemId)) {
      this.selectedItems.delete(itemId);
    } else {
      this.selectedItems.add(itemId);
    }
    this.render();
  }

  // 打开书签
  async openBookmark(url) {
    try {
      await chrome.tabs.create({ url });
      // 从历史记录删除
      await chrome.history.deleteUrl({ url });
    } catch (e) {
      console.error('打开书签失败:', e);
      this.showNotification('打开失败', 'error');
    }
  }

  // 更新选择信息
  updateSelectionInfo() {
    const count = this.selectedItems.size;
    document.getElementById('selected-count').textContent = `已选择 ${count} 项`;
    document.getElementById('restore-btn').disabled = count === 0;
    document.getElementById('delete-btn').disabled = count === 0;
  }

  // 添加当前页面（直接在 popup 中操作，不经过 service worker）
  async addCurrentPage() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) {
        this.showNotification('无法获取当前页面', 'error');
        return;
      }
      
      // 检查是否为内部页面
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        this.showNotification('无法隔离内部页面', 'error');
        return;
      }

      // 直接操作 storage，写入隔离书签
      const result = await chrome.storage.local.get('isolatedBookmarks');
      const isolatedBookmarks = result.isolatedBookmarks || { folders: [], bookmarks: [] };

      // 去重检查
      const exists = isolatedBookmarks.bookmarks.some(bm => bm.url === tab.url);
      if (exists) {
        this.showNotification('该页面已在隔离区', 'error');
        return;
      }

      const newBookmark = {
        id: `bookmark_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: tab.title || tab.url,
        url: tab.url,
        parentId: null,
        dateAdded: Date.now()
      };
      isolatedBookmarks.bookmarks.push(newBookmark);
      await chrome.storage.local.set({ isolatedBookmarks });

      // 从历史记录删除
      try { await chrome.history.deleteUrl({ url: tab.url }); } catch (_) {}

      // 若在 Chrome 书签中也删除
      try {
        const found = await chrome.bookmarks.search({ url: tab.url });
        for (const bm of found) {
          await chrome.bookmarks.remove(bm.id);
        }
      } catch (_) {}

      await this.loadBookmarks();
      this.render();
      this.showNotification('已添加到隔离区');
    } catch (e) {
      console.error('添加当前页失败:', e);
      this.showNotification('添加失败: ' + e.message, 'error');
    }
  }

  // 恢复选中的书签
  async restoreSelected() {
    const bookmarkIds = Array.from(this.selectedItems).filter(id => 
      this.isolatedBookmarks.bookmarks.some(bm => bm.id === id)
    );
    
    if (bookmarkIds.length === 0) return;
    
    this.showConfirm(
      '恢复书签',
      `确定要恢复 ${bookmarkIds.length} 个书签到 Chrome 书签吗？`,
      async () => {
        try {
          for (const id of bookmarkIds) {
            await sendMessageWithRetry({ action: 'restoreBookmark', bookmarkId: id });
          }
          await this.loadBookmarks();
          this.selectedItems.clear();
          this.render();
          this.showNotification('书签已恢复');
        } catch (e) {
          console.error('恢复书签失败:', e);
          this.showNotification('恢复失败', 'error');
        }
      }
    );
  }

  // 删除选中的书签
  async deleteSelected() {
    const itemIds = Array.from(this.selectedItems);
    if (itemIds.length === 0) return;
    
    this.showConfirm(
      '删除书签',
      `确定要彻底删除 ${itemIds.length} 个项目吗？此操作不可撤销。`,
      async () => {
        try {
          // 删除书签
          this.isolatedBookmarks.bookmarks = this.isolatedBookmarks.bookmarks.filter(
            bm => !this.selectedItems.has(bm.id)
          );
          
          // 删除文件夹及其子项
          const foldersToDelete = itemIds.filter(id => 
            this.isolatedBookmarks.folders.some(f => f.id === id)
          );
          
          const deleteFolderRecursively = (folderId) => {
            const folder = this.isolatedBookmarks.folders.find(f => f.id === folderId);
            if (!folder) return;
            
            // 删除子文件夹
            const childFolders = this.isolatedBookmarks.folders.filter(f => f.parentId === folderId);
            childFolders.forEach(f => deleteFolderRecursively(f.id));
            
            // 删除子书签
            this.isolatedBookmarks.bookmarks = this.isolatedBookmarks.bookmarks.filter(
              bm => bm.parentId !== folderId
            );
            
            // 删除文件夹本身
            this.isolatedBookmarks.folders = this.isolatedBookmarks.folders.filter(
              f => f.id !== folderId
            );
          };
          
          foldersToDelete.forEach(id => deleteFolderRecursively(id));
          
          await this.saveBookmarks();
          this.selectedItems.clear();
          this.render();
          this.showNotification('已删除');
        } catch (e) {
          console.error('删除失败:', e);
          this.showNotification('删除失败', 'error');
        }
      }
    );
  }

  // 拖拽开始
  handleDragStart(e, node) {
    this.draggedItem = node;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  }

  // 拖拽结束
  handleDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.tree-item').forEach(item => {
      item.classList.remove('drag-over');
    });
    this.draggedItem = null;
  }

  // 拖拽经过
  handleDragOver(e, folder) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
  }

  // 拖拽离开
  handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
  }

  // 放置
  async handleDrop(e, folder) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    
    if (!this.draggedItem || this.draggedItem.id === folder.id) return;
    
    // 更新书签的父文件夹
    const bookmark = this.isolatedBookmarks.bookmarks.find(bm => bm.id === this.draggedItem.id);
    if (bookmark) {
      bookmark.parentId = folder.id;
      await this.saveBookmarks();
      this.render();
      this.showNotification('已移动到新文件夹');
    }
  }

  // 显示确认对话框
  showConfirm(title, message, onConfirm) {
    this.confirmCallback = onConfirm;
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-dialog').classList.remove('hidden');
  }

  // 隐藏确认对话框
  hideConfirm() {
    document.getElementById('confirm-dialog').classList.add('hidden');
    this.confirmCallback = null;
  }

  // 确认操作
  confirmAction() {
    if (this.confirmCallback) {
      this.confirmCallback();
      this.hideConfirm();
    }
  }

  // 显示通知
  showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.remove('hidden');
    
    setTimeout(() => {
      notification.classList.add('hidden');
    }, 3000);
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  new BookmarkManager();
});