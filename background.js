// 存储标签页最后访问时间
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const currentTime = Date.now();
    await chrome.storage.local.set({ [activeInfo.tabId]: currentTime });
  } catch (error) {
    // 静默处理错误
  }
});

// 每5分钟检查一次不活跃的标签
chrome.alarms.create('checkInactiveTabs', { periodInMinutes: 5 });

// 合并所有定时任务的处理
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkInactiveTabs') {
    await checkAndCloseInactiveTabs();
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
    if (!result.autoCloseEnabled) {
      return;
    }
    
    const whitelist = result.whitelist || [];
    const defaultThreshold = 24 * 60 * 60 * 1000;
    const inactiveTime = result.testMode ? 60 * 1000 : (result.inactiveThreshold || defaultThreshold);
    
    // 获取当前活跃的标签
    const currentTabs = await chrome.tabs.query({ active: true });  // 修改：获取所有窗口的活跃标签
    const activeTabIds = currentTabs.map(tab => tab.id);  // 修改：保存所有活跃标签的ID

    const tabs = await chrome.tabs.query({});
    
    const tabIds = tabs.map(tab => tab.id.toString());
    const lastAccessTimes = await chrome.storage.local.get(tabIds);
    
    for (const tab of tabs) {
      // 跳过所有活跃的标签
      if (activeTabIds.includes(tab.id)) {  // 修改：检查是否是活跃标签
        continue;
      }

      if (!isValidUrl(tab.url)) {
        continue;
      }
      
      const domain = new URL(tab.url).hostname;
      if (whitelist.includes(domain)) {
        continue;
      }
      
      const lastAccessTime = lastAccessTimes[tab.id] || Date.now();
      const timeSinceLastAccess = Date.now() - lastAccessTime;
      
      if (timeSinceLastAccess >= inactiveTime) {
        try {
          await chrome.tabs.remove(tab.id);
          showCloseNotification(tab);
        } catch (error) {
          // 静默处理错误
        }
      }
    }
  });
}

// 监听标签页更新，更新最后访问时间
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    try {
      const currentTime = Date.now();
      await chrome.storage.local.set({ [tabId]: currentTime });
    } catch (error) {
      // 静默处理错误
    }
  }
});

// 监听标签页关闭事件，清理存储的时间记录
chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    await chrome.storage.local.remove(tabId.toString());
  } catch (error) {
    // 静默处理错误
  }
});

// 监听导航事件，更新活跃时间
chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId === 0) {
    try {
      const currentTime = Date.now();
      await chrome.storage.local.set({ [details.tabId]: currentTime });
    } catch (error) {
      // 静默处理错误
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
    // 静默处理错误
  }
});

// 添加通知点击处理
chrome.notifications.onClicked.addListener((notificationId) => {
  // 清除通知
  chrome.notifications.clear(notificationId);
});

// 修改通知创建
function showCloseNotification(tab) {
  try {
    chrome.notifications.create(`close-${tab.id}`, {
      type: 'basic',
      iconUrl: '/icon-48.png',  // 使用 PNG 图标
      title: '标签页自动关闭提醒',
      message: `标签 "${tab.title}" 已被自动关闭`,
      requireInteraction: false,
      priority: 0
    });
  } catch (error) {
    // 静默处理错误
  }
}

// 初始化定时任务
async function initAlarms() {
  const result = await chrome.storage.local.get(['testMode']);
  const checkInterval = result.testMode ? 0.5 : 5;
  await chrome.alarms.create('checkInactiveTabs', { 
    periodInMinutes: checkInterval
  });
}

// 在插件启动和浏览器启动时初始化
chrome.runtime.onInstalled.addListener(initAlarms);
chrome.runtime.onStartup.addListener(initAlarms);

// 在测试模式切换时更新检查间隔
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.testMode) {
    const checkInterval = changes.testMode.newValue ? 0.5 : 5;
    chrome.alarms.create('checkInactiveTabs', { periodInMinutes: checkInterval });
  }
});

// 优化现有的存储访问，使用 async/await
async function updateSettings(key, value) {
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch (error) {
    // 静默处理错误
  }
}