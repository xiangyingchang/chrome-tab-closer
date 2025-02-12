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

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkInactiveTabs') {
    checkAndCloseInactiveTabs();
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
  chrome.storage.local.get(['whitelist', 'autoCloseEnabled', 'inactiveThreshold'], async (result) => {
    if (!result.autoCloseEnabled) return;
    
    const whitelist = result.whitelist || [];
    const tabs = await chrome.tabs.query({});
    
    tabs.forEach(tab => {
      const domain = new URL(tab.url).hostname;
      if (whitelist.includes(domain)) return;
      
      // 默认24小时，可通过配置修改
      const defaultThreshold = 24 * 60 * 60 * 1000;
      const inactiveTime = result.testMode ? 60 * 1000 : (result.inactiveThreshold || defaultThreshold);
      const currentTime = Date.now();

      const lastAccessTime = result[tab.id] || currentTime;
      if (currentTime - lastAccessTime >= inactiveTime) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon.svg',
          title: '标签页自动关闭提醒',
          message: `标签 "${tab.title}" 已被自动关闭`
        });
        chrome.tabs.remove(tab.id);
        console.log(`关闭不活跃标签: ${tab.title}`);
      }
    });
  });
}

// 监听标签页更新，更新最后访问时间
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    const currentTime = Date.now();
    chrome.storage.local.set({ [tabId]: currentTime });
  }
});

// 监听标签页关闭事件，清理存储的时间记录
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(tabId.toString());
});

// 监听导航事件，更新活跃时间
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId === 0) { // 只处理主框架的导航
    const currentTime = Date.now();
    chrome.storage.local.set({ [details.tabId]: currentTime });
  }
});

// 浏览器启动时初始化所有标签页的时间记录
chrome.runtime.onStartup.addListener(() => {
  const currentTime = Date.now();
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      chrome.storage.local.set({ [tab.id]: currentTime });
    });
  });
});