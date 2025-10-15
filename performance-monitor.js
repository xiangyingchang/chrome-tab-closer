// 性能监控工具 - 可选添加到插件中

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      checkCount: 0,
      totalCheckTime: 0,
      avgCheckTime: 0,
      tabsProcessed: 0,
      tabsClosed: 0,
      memoryUsage: 0
    };
    this.startTime = Date.now();
  }

  // 开始性能测量
  startCheck() {
    return performance.now();
  }

  // 结束性能测量
  endCheck(startTime, tabCount, closedCount = 0) {
    const duration = performance.now() - startTime;
    this.metrics.checkCount++;
    this.metrics.totalCheckTime += duration;
    this.metrics.avgCheckTime = this.metrics.totalCheckTime / this.metrics.checkCount;
    this.metrics.tabsProcessed += tabCount;
    this.metrics.tabsClosed += closedCount;
    
    // 每100次检查输出一次统计
    if (this.metrics.checkCount % 100 === 0) {
      this.logStats();
    }
  }

  // 获取内存使用情况
  async getMemoryUsage() {
    try {
      const data = await chrome.storage.local.get(null);
      const size = JSON.stringify(data).length;
      this.metrics.memoryUsage = size;
      return size;
    } catch (error) {
      return 0;
    }
  }

  // 输出统计信息
  logStats() {
    const uptime = (Date.now() - this.startTime) / 1000 / 60; // 分钟
    console.log('📊 插件性能统计:', {
      运行时间: `${uptime.toFixed(1)}分钟`,
      检查次数: this.metrics.checkCount,
      平均检查耗时: `${this.metrics.avgCheckTime.toFixed(2)}ms`,
      处理标签总数: this.metrics.tabsProcessed,
      关闭标签总数: this.metrics.tabsClosed,
      存储占用: `${(this.metrics.memoryUsage / 1024).toFixed(2)}KB`,
      效率: `${(this.metrics.tabsProcessed / this.metrics.checkCount).toFixed(1)}标签/次`
    });
  }

  // 获取完整报告
  getReport() {
    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime,
      efficiency: this.metrics.tabsProcessed / this.metrics.checkCount || 0
    };
  }
}

// 使用示例（在background.js中）:
/*
const monitor = new PerformanceMonitor();

async function checkAndCloseInactiveTabs() {
  const startTime = monitor.startCheck();
  
  // ... 原有的检查逻辑 ...
  
  monitor.endCheck(startTime, tabs.length, closedCount);
  await monitor.getMemoryUsage();
}
*/