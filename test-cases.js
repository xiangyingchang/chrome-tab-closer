// 这些是手动测试的步骤，可以后续改写为自动化测试

async function testWhitelist() {
  // 1. 添加白名单
  await addToWhitelist('example.com');
  
  // 2. 打开测试标签
  const tab = await chrome.tabs.create({ url: 'https://example.com' });
  
  // 3. 设置为不活跃
  await chrome.storage.local.set({ [tab.id]: Date.now() - (2 * 60 * 1000) });
  
  // 4. 触发检查
  await checkAndCloseInactiveTabs();
  
  // 5. 验证标签是否仍然存在
  const tabs = await chrome.tabs.query({});
  const tabExists = tabs.some(t => t.id === tab.id);
  console.assert(tabExists, '白名单测试失败：标签被错误关闭');
}

// 更多测试用例... 