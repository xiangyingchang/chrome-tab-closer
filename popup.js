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
  debounce(function(e) {
    const hours = parseInt(e.target.value) || 24;
    const threshold = hours * 60 * 60 * 1000;
    updateSettings('inactiveThreshold', threshold);
  }, 300)
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
  document.getElementById('inactiveThreshold').value = result.inactiveThreshold ? (result.inactiveThreshold / (60 * 60 * 1000)) : 24;
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
});

// 优化现有的存储访问，使用 async/await
async function updateSettings(key, value) {
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch (error) {
    console.error(`Failed to update ${key}:`, error);
  }
}