// 存储标签页最后访问时间
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const currentTime = Date.now();
    await chrome.storage.local.set({ [activeInfo.tabId]: currentTime });
  } catch (error) {
    console.error('Failed to update tab access time:', error);
  }
});

// 每5分钟检查一次不活跃的标签
chrome.alarms.create('checkInactiveTabs', { periodInMinutes: 5 });

// 合并所有定时任务的处理
chrome.alarms.onAlarm.addListener(async (alarm) => {
  try {
    switch (alarm.name) {
      case 'checkInactiveTabs':
        await checkAndCloseInactiveTabs();
        break;
      case 'cleanupStorage':
        await cleanupOldData();
        break;
    }
  } catch (error) {
    console.error(`Failed to handle alarm ${alarm.name}:`, error);
  }
});

function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function checkAndCloseInactiveTabs() {
  chrome.storage.local.get(['whitelist', 'autoCloseEnabled', 'inactiveThreshold', 'testMode'], async (result) => {
    if (!result.autoCloseEnabled) return;
    
    const whitelist = result.whitelist || [];
    const defaultThreshold = 24 * 60 * 60 * 1000;
    const inactiveTime = result.testMode ? 60 * 1000 : (result.inactiveThreshold || defaultThreshold);
    const currentTime = Date.now();
    
    // 批量获取所有标签的最后访问时间
    const tabs = await chrome.tabs.query({});
    const tabIds = tabs.map(tab => tab.id.toString());
    const lastAccessTimes = await chrome.storage.local.get(tabIds);
    
    tabs.forEach(tab => {
      if (!isValidUrl(tab.url)) return;
      
      const domain = new URL(tab.url).hostname;
      if (whitelist.includes(domain)) return;
      
      const lastAccessTime = lastAccessTimes[tab.id] || currentTime;
      if (currentTime - lastAccessTime >= inactiveTime) {
        showCloseNotification(tab);
        chrome.tabs.remove(tab.id);
      }
    });
  });
}

// 监听标签页更新，更新最后访问时间
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    try {
      const currentTime = Date.now();
      await chrome.storage.local.set({ [tabId]: currentTime });
    } catch (error) {
      console.error('Failed to update tab time on update:', error);
    }
  }
});

// 监听标签页关闭事件，清理存储的时间记录
chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    await chrome.storage.local.remove(tabId.toString());
  } catch (error) {
    console.error('Failed to cleanup tab data:', error);
  }
});

// 监听导航事件，更新活跃时间
chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId === 0) {
    try {
      const currentTime = Date.now();
      await chrome.storage.local.set({ [details.tabId]: currentTime });
    } catch (error) {
      console.error('Failed to update tab time on navigation:', error);
    }
  }
});

// 浏览器启动时初始化所有标签页的时间记录
chrome.runtime.onStartup.addListener(async () => {
  try {
    const currentTime = Date.now();
    const tabs = await chrome.tabs.query({});
    const updates = tabs.reduce((acc, tab) => {
      acc[tab.id] = currentTime;
      return acc;
    }, {});
    await chrome.storage.local.set(updates);
  } catch (error) {
    console.error('Failed to initialize tab times:', error);
  }
});

async function cleanupOldData() {
  try {
    const currentTime = Date.now();
    const data = await chrome.storage.local.get(null);
    const keysToRemove = Object.keys(data).filter(key => {
      // 只处理数字类型的key（tabId）
      return !isNaN(key) && currentTime - data[key] > 7 * 24 * 60 * 60 * 1000;
    });
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
      logDebug('Cleaned up old data', keysToRemove);
    }
  } catch (error) {
    console.error('Failed to cleanup old data:', error);
  }
}

function logDebug(message, data = null) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Tab Closer] ${message}`, data || '');
  }
}

// 添加通知点击处理
chrome.notifications.onClicked.addListener((notificationId) => {
  // 清除通知
  chrome.notifications.clear(notificationId);
});

// 修改通知创建
function showCloseNotification(tab) {
  chrome.notifications.create(`close-${tab.id}`, {
    type: 'basic',
    iconUrl: 'icon.svg',
    title: '标签页自动关闭提醒',
    message: `标签 "${tab.title}" 已被自动关闭`,
    requireInteraction: false, // 自动关闭通知
    priority: 0
  });
}

// 初始化定时任务
function initAlarms() {
  chrome.alarms.create('checkInactiveTabs', { periodInMinutes: 5 });
  chrome.alarms.create('cleanupStorage', { periodInMinutes: 60 });
}

// 在插件启动和浏览器启动时初始化
chrome.runtime.onInstalled.addListener(initAlarms);
chrome.runtime.onStartup.addListener(initAlarms);

const CONFIG = {
  CHECK_INTERVAL: 5, // 检查间隔（分钟）
  CLEANUP_INTERVAL: 60, // 清理间隔（分钟）
  DEFAULT_INACTIVE_THRESHOLD: 24 * 60 * 60 * 1000, // 默认不活跃阈值（24小时）
  TEST_MODE_THRESHOLD: 60 * 1000, // 测试模式阈值（1分钟）
  OLD_DATA_THRESHOLD: 7 * 24 * 60 * 60 * 1000 // 过期数据阈值（7天）
};