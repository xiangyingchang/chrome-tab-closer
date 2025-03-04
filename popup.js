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
document.getElementById('autoCloseInactive').addEventListener('change', async function(e) {
  try {
    if (e.target.checked) {
      await chrome.alarms.create('checkInactiveTabs', { periodInMinutes: 5 });
    } else {
      await chrome.alarms.clear('checkInactiveTabs');
    }
    await updateSettings('autoCloseEnabled', e.target.checked);
  } catch (error) {
    console.error('Failed to update auto close setting:', error);
  }
});

// 不活跃时间阈值控制
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 使用防抖优化输入处理
document.getElementById('inactiveThreshold').addEventListener('change', 
  async function(e) {
    const hours = parseInt(e.target.value) || 24;
    const threshold = hours * 60 * 60 * 1000;
    console.log(`设置不活跃阈值: ${hours}小时 (${threshold}毫秒)`);
    await updateSettings('inactiveThreshold', threshold);
    
    // 立即检查当前设置
    const settings = await chrome.storage.local.get(['inactiveThreshold']);
    console.log(`保存后的阈值: ${settings.inactiveThreshold / (60 * 60 * 1000)}小时`);
  }
);

// 添加测试模式控制
document.getElementById('testMode').addEventListener('change', async function(e) {
  try {
    // 保存测试模式状态
    await chrome.storage.local.set({ testMode: e.target.checked });
    
    // 立即更新检查间隔
    const checkInterval = e.target.checked ? 0.5 : 5;
    await chrome.alarms.create('checkInactiveTabs', { periodInMinutes: checkInterval });
  } catch (error) {
    // 静默处理错误
  }
});

// 初始化所有设置状态
chrome.storage.local.get(['autoCloseEnabled', 'testMode', 'inactiveThreshold'], function(result) {
  document.getElementById('autoCloseInactive').checked = result.autoCloseEnabled || false;
  document.getElementById('testMode').checked = result.testMode || false;
  
  // 获取输入值
  const inputElement = document.getElementById('inactiveThreshold');
  const hours = parseInt(inputElement.value) || 24;
  inputElement.value = hours;
  
  // 如果没有保存过阈值，则保存当前值
  if (!result.inactiveThreshold) {
    const threshold = hours * 60 * 60 * 1000;
    updateSettings('inactiveThreshold', threshold);
  } else {
    // 显示保存的值
    inputElement.value = result.inactiveThreshold / (60 * 60 * 1000);
  }
});

// 白名单管理
function initWhitelist() {
  chrome.storage.local.get(['whitelist'], (result) => {
    const whitelist = result.whitelist || [];
    renderWhitelist(whitelist);
  });
}

function renderWhitelist(whitelist) {
  const container = document.getElementById('whitelistContainer');
  container.innerHTML = '';
  
  whitelist.forEach(domain => {
    const item = document.createElement('div');
    item.className = 'whitelist-item';
    
    const domainText = document.createElement('span');
    domainText.textContent = domain;
    
    const removeButton = document.createElement('button');
    removeButton.innerHTML = '<span class="material-icons">delete</span>';
    removeButton.onclick = () => removeFromWhitelist(domain);
    
    item.appendChild(domainText);
    item.appendChild(removeButton);
    container.appendChild(item);
  });
}

function addToWhitelist() {
  const input = document.getElementById('whitelistInput');
  const domain = input.value.trim().toLowerCase();
  
  if (!domain) return;
  
  try {
    // 验证输入的是否是有效的域名格式
    new URL(`http://${domain}`);
    
    chrome.storage.local.get(['whitelist'], (result) => {
      const whitelist = result.whitelist || [];
      if (!whitelist.includes(domain)) {
        whitelist.push(domain);
        chrome.storage.local.set({ whitelist }, () => {
          renderWhitelist(whitelist);
          input.value = '';
        });
      }
    });
  } catch (error) {
    alert('请输入有效的域名');
  }
}

function removeFromWhitelist(domain) {
  chrome.storage.local.get(['whitelist'], (result) => {
    const whitelist = (result.whitelist || []).filter(d => d !== domain);
    chrome.storage.local.set({ whitelist }, () => {
      renderWhitelist(whitelist);
    });
  });
}

// 初始化白名单界面
document.addEventListener('DOMContentLoaded', () => {
  // ... 现有的初始化代码 ...
  
  initWhitelist();
  
  document.getElementById('addWhitelist').addEventListener('click', addToWhitelist);
  document.getElementById('whitelistInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addToWhitelist();
    }
  });
  
  // 添加调试按钮
  const settingsSection = document.querySelector('.settings-section');
  const debugButton = document.createElement('button');
  debugButton.textContent = '检查设置状态';
  debugButton.style.marginTop = '16px';
  debugButton.addEventListener('click', async () => {
    const response = await chrome.runtime.sendMessage({action: 'getDebugInfo'});
    console.log('Debug Info:', response);
    alert('设置信息已输出到控制台，请按F12查看');
  });
  settingsSection.appendChild(debugButton);

  // 添加强制检查按钮
  const forceCheckButton = document.createElement('button');
  forceCheckButton.textContent = '立即检查不活跃标签';
  forceCheckButton.style.marginTop = '8px';
  forceCheckButton.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({action: 'forceCheck'});
    alert('已执行不活跃标签检查');
  });
  settingsSection.appendChild(forceCheckButton);

  // 添加重置按钮
  const resetButton = document.createElement('button');
  resetButton.textContent = '重置所有标签时间';
  resetButton.style.marginTop = '8px';
  resetButton.style.backgroundColor = '#dc3545';
  resetButton.addEventListener('click', async () => {
    if (confirm('这将把所有非活跃标签的访问时间重置为24小时前，确定继续吗？')) {
      const response = await chrome.runtime.sendMessage({
        action: 'resetAllTabTimes',
        hours: 24
      });
      alert(response.message);
      // 立即执行检查
      await chrome.runtime.sendMessage({action: 'forceCheck'});
    }
  });
  settingsSection.appendChild(resetButton);
});

// 优化现有的存储访问，使用 async/await
async function updateSettings(key, value) {
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch (error) {
    console.error(`Failed to update ${key}:`, error);
  }
}