// 保留原有的关闭功能代码
document.getElementById('closeCurrent').addEventListener('click', function() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.remove(tabs[0].id);
  });
});

document.getElementById('closeOthers').addEventListener('click', function() {
  chrome.tabs.query({currentWindow: true}, function(tabs) {
    const currentTab = tabs.find(tab => tab.active);
    const tabIds = tabs
      .filter(tab => !tab.active)
      .map(tab => tab.id);
    chrome.tabs.remove(tabIds);
  });
});

document.getElementById('closeAll').addEventListener('click', function() {
  chrome.tabs.query({currentWindow: true}, function(tabs) {
    const tabIds = tabs.map(tab => tab.id);
    chrome.tabs.remove(tabIds);
  });
});

// 自动关闭不活跃标签的开关控制
document.getElementById('autoCloseInactive').addEventListener('change', function(e) {
  if (e.target.checked) {
    chrome.alarms.create('checkInactiveTabs', { periodInMinutes: 5 });
  } else {
    chrome.alarms.clear('checkInactiveTabs');
  }
  chrome.storage.local.set({ autoCloseEnabled: e.target.checked });
});

// 不活跃时间阈值控制
document.getElementById('inactiveThreshold').addEventListener('change', function(e) {
  const hours = parseInt(e.target.value) || 24;
  const threshold = hours * 60 * 60 * 1000; // 转换为毫秒
  chrome.storage.local.set({ inactiveThreshold: threshold });
});



// 添加测试模式控制
document.getElementById('testMode').addEventListener('change', function(e) {
  chrome.storage.local.set({ testMode: e.target.checked });
});

// 初始化所有设置状态
chrome.storage.local.get(['autoCloseEnabled', 'testMode', 'inactiveThreshold'], function(result) {
  document.getElementById('autoCloseInactive').checked = result.autoCloseEnabled || false;
  document.getElementById('testMode').checked = result.testMode || false;
  document.getElementById('inactiveThreshold').value = result.inactiveThreshold ? (result.inactiveThreshold / (60 * 60 * 1000)) : 24;
});