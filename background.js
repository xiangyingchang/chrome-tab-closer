// 存储标签页最后访问时间
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const currentTime = Date.now();
    await chrome.storage.local.set({ [activeInfo.tabId.toString()]: currentTime });
    console.log(`标签 ${activeInfo.tabId} 被激活，时间已更新`);
  } catch (error) {
    console.error('更新标签访问时间失败:', error);
  }
});

// 监听标签页更新事件（用户访问新页面）
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
    try {
      const currentTime = Date.now();
      await chrome.storage.local.set({ [tabId.toString()]: currentTime });
      console.log(`标签 ${tabId} 页面加载完成，时间已更新`);
    } catch (error) {
      console.error('更新标签访问时间失败:', error);
    }
  }
});

// 初始化时不自动创建alarm，等用户启用后再创建
// chrome.alarms.create('checkInactiveTabs', { periodInMinutes: 5 });

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

async function checkAndCloseInactiveTabs() {
  try {
    const result = await chrome.storage.local.get(['whitelist', 'autoCloseEnabled', 'inactiveThreshold', 'testMode']);
    // 性能优化：减少控制台输出频率
    if (Math.random() < 0.1) { // 10%概率输出日志，减少性能影响
      console.log("检查配置:", {
        autoCloseEnabled: result.autoCloseEnabled,
        testMode: result.testMode,
        inactiveThreshold: result.inactiveThreshold,
        inactiveThresholdHours: result.inactiveThreshold ? (result.inactiveThreshold / (60 * 60 * 1000)) : 'not set'
      });
    }
    
    if (!result.autoCloseEnabled) {
      console.log("自动关闭未启用");
      return;
    }
    
    const whitelist = result.whitelist || [];
    const defaultThreshold = 24 * 60 * 60 * 1000;
    const inactiveTime = result.testMode ? 60 * 1000 : (result.inactiveThreshold || defaultThreshold);
    
    console.log("使用的不活跃阈值:", {
      testMode: result.testMode,
      inactiveTimeMs: inactiveTime,
      inactiveTimeHours: inactiveTime / (60 * 60 * 1000)
    });
    
    // 获取当前活跃的标签
    const currentTabs = await chrome.tabs.query({ active: true });
    const activeTabIds = currentTabs.map(tab => tab.id);

    const tabs = await chrome.tabs.query({});
    
    const tabIds = tabs.map(tab => tab.id.toString());
    const lastAccessTimes = await chrome.storage.local.get(tabIds);
    
    const currentTime = Date.now();
    
    for (const tab of tabs) {
      // 跳过所有活跃的标签
      if (activeTabIds.includes(tab.id)) {
        continue;
      }

      if (!isValidUrl(tab.url)) {
        continue;
      }
      
      const domain = new URL(tab.url).hostname;
      if (whitelist.includes(domain)) {
        continue;
      }
      
      // 修改：如果没有记录，使用一个较早的时间而不是当前时间
      const lastAccessTime = lastAccessTimes[tab.id.toString()];
      
      // 如果没有访问记录，可能是新打开的标签，更新它的时间并跳过
      if (!lastAccessTime) {
        await chrome.storage.local.set({ [tab.id.toString()]: currentTime });
        continue;
      }
      
      const timeSinceLastAccess = currentTime - lastAccessTime;
      
      if (timeSinceLastAccess >= inactiveTime) {
        try {
          await chrome.tabs.remove(tab.id);
          showCloseNotification(tab);
        } catch (error) {
          // 静默处理错误
        }
      }
    }
  } catch (error) {
    console.error('检查不活跃标签时出错:', error);
  }
}

// 监听标签页关闭事件，清理存储的时间记录
chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    await chrome.storage.local.remove(tabId.toString());
  } catch (error) {
    // 静默处理错误
  }
});

// 浏览器启动时初始化所有标签页的时间记录
chrome.runtime.onStartup.addListener(async () => {
  try {
    // 只为没有记录的标签设置时间
    const currentTime = Date.now();
    const tabs = await chrome.tabs.query({});
    const tabIds = tabs.map(tab => tab.id.toString());
    const existingTimes = await chrome.storage.local.get(tabIds);
    
    // 只为没有记录的标签创建新记录
    const updates = {};
    tabs.forEach(tab => {
      const tabIdStr = tab.id.toString();
      if (!existingTimes[tabIdStr]) {
        updates[tabIdStr] = currentTime;
      }
    });
    
    if (Object.keys(updates).length > 0) {
      await chrome.storage.local.set(updates);
    }
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
  try {
    // 清除现有的alarm
    await chrome.alarms.clear('checkInactiveTabs');
    
    const result = await chrome.storage.local.get(['testMode', 'autoCloseEnabled']);
    
    // 只有在启用自动关闭时才创建alarm
    if (result.autoCloseEnabled) {
      const checkInterval = result.testMode ? 0.5 : 5;
      await chrome.alarms.create('checkInactiveTabs', { 
        periodInMinutes: checkInterval
      });
      console.log(`已创建定时任务，检查间隔: ${checkInterval} 分钟`);
    } else {
      console.log('自动关闭未启用，跳过创建定时任务');
    }
  } catch (error) {
    console.error('初始化定时任务失败:', error);
  }
}

// 在插件启动和浏览器启动时初始化
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('插件安装/更新:', details.reason);
  
  try {
    const result = await chrome.storage.local.get(['inactiveThreshold', 'autoCloseEnabled']);
    
    if (!result.inactiveThreshold) {
      // 设置默认为24小时
      const defaultThreshold = 24 * 60 * 60 * 1000;
      await chrome.storage.local.set({ 
        inactiveThreshold: defaultThreshold,
        autoCloseEnabled: false // 默认关闭自动清理
      });
      console.log("已设置默认配置:", { threshold: defaultThreshold, enabled: false });
    }
    
    await initAlarms();
    
    // 初始化所有当前标签的时间戳
    const tabs = await chrome.tabs.query({});
    const currentTime = Date.now();
    const updates = {};
    
    for (const tab of tabs) {
      updates[tab.id.toString()] = currentTime;
    }
    
    if (Object.keys(updates).length > 0) {
      await chrome.storage.local.set(updates);
      console.log(`已初始化 ${Object.keys(updates).length} 个标签的时间戳`);
    }
  } catch (error) {
    console.error('插件初始化失败:', error);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('浏览器启动');
  await initAlarms();
});

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

// 添加到 background.js 末尾
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getDebugInfo') {
    (async () => {
      try {
        const data = await chrome.storage.local.get(null);
        const tabs = await chrome.tabs.query({});
        const tabInfo = tabs.map(tab => ({
          id: tab.id,
          title: tab.title,
          url: tab.url,
          lastAccess: data[tab.id.toString()] ? new Date(data[tab.id.toString()]).toLocaleString() : 'unknown'
        }));
        
        const debugInfo = {
          settings: {
            autoCloseEnabled: data.autoCloseEnabled,
            testMode: data.testMode,
            inactiveThreshold: data.inactiveThreshold ? `${data.inactiveThreshold / (60 * 60 * 1000)} hours` : 'not set',
            whitelist: data.whitelist || []
          },
          tabs: tabInfo,
          currentTime: new Date().toLocaleString()
        };
        
        sendResponse(debugInfo);
      } catch (error) {
        sendResponse({ error: error.message });
      }
    })();
    return true; // 保持消息通道开放，等待异步响应
  }

  if (message.action === 'forceCheck') {
    checkAndCloseInactiveTabs();
    sendResponse({success: true});
    return true;
  }

  if (message.action === 'resetAllTabTimes') {
    (async () => {
      try {
        const hoursAgo = message.hours || 24;
        const resetTime = Date.now() - (hoursAgo * 60 * 60 * 1000);
        
        const tabs = await chrome.tabs.query({});
        const updates = tabs.reduce((acc, tab) => {
          // 跳过当前活跃的标签
          if (tab.active) return acc;
          acc[tab.id.toString()] = resetTime;
          return acc;
        }, {});
        
        await chrome.storage.local.set(updates);
        sendResponse({
          success: true, 
          message: `已将${Object.keys(updates).length}个标签的访问时间设置为${hoursAgo}小时前`
        });
      } catch (error) {
        sendResponse({ error: error.message });
      }
    })();
    return true;
  }
});