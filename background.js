// 存储标签页最后访问时间
chrome.tabs.onActivated.addListener((activeInfo) => {
  const currentTime = Date.now();
  chrome.storage.local.set({ [activeInfo.tabId]: currentTime });
});

// 每5分钟检查一次不活跃的标签
chrome.alarms.create('checkInactiveTabs', { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkInactiveTabs') {
    checkAndCloseInactiveTabs();
  }
});

function checkAndCloseInactiveTabs() {
  chrome.storage.local.get(['testMode', 'inactiveThreshold', 'autoCloseEnabled'], (result) => {
    // 如果自动关闭功能未启用，则不执行检查
    if (!result.autoCloseEnabled) {
      return;
    }

    // 默认24小时，可通过配置修改
    const defaultThreshold = 24 * 60 * 60 * 1000;
    const inactiveTime = result.testMode ? 60 * 1000 : (result.inactiveThreshold || defaultThreshold);
    const currentTime = Date.now();

    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {

          chrome.storage.local.get([tab.id.toString()], (result) => {
            const lastAccessTime = result[tab.id] || currentTime;
            if (currentTime - lastAccessTime >= inactiveTime) {
              chrome.tabs.remove(tab.id);
              console.log(`关闭不活跃标签: ${tab.title}`);
            }
          });
      });
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