/**
 * 一鉴到底桌宠核心代码示例
 *
 * 这是一个简化的桌宠实现，展示核心逻辑
 */

class PetManager {
  constructor(config = {}) {
    this.name = config.name || "小鉴";
    this.position = config.position || { x: 100, y: 100 };
    this.state = "green"; // green/yellow/red
    this.onStateChange = config.onStateChange || (() => {});
    this.onRiskDetected = config.onRiskDetected || (() => {});

    this.init();
  }

  init() {
    console.log(`${this.name} 桌宠初始化完成`);
    this.createPetWindow();
    this.startMonitoring();
  }

  // 创建桌宠窗口
  createPetWindow() {
    // 这里使用Electron的BrowserWindow API
    this.window = {
      show: () => console.log("显示桌宠"),
      hide: () => console.log("隐藏桌宠"),
      setPosition: (x, y) => {
        this.position = { x, y };
        console.log(`移动到: ${x}, ${y}`);
      },
      setState: (state) => {
        this.state = state;
        this.renderPet();
        this.onStateChange(state);
      }
    };
  }

  // 渲染桌宠形象
  renderPet() {
    const petImages = {
      green: "🟢 小鉴微笑",
      yellow: "🟡 小鉴专注",
      red: "🔴 小鉴严肃"
    };

    console.log(petImages[this.state]);
  }

  // 开始监控
  startMonitoring() {
    // 模拟监控逻辑
    console.log("开始监控系统...");

    // 示例：监听剪贴板变化
    this.monitorClipboard();

    // 示例：监听文件系统
    this.monitorFileSystem();

    // 示例：监听进程启动
    this.monitorProcesses();
  }

  // 监控剪贴板
  async monitorClipboard() {
    // 这里应该集成实际的剪贴板监听
    console.log("监控剪贴板...");
  }

  // 监控文件系统
  async monitorFileSystem() {
    // 这里应该集成实际的文件系统监控
    console.log("监控文件系统...");
  }

  // 监控进程
  async monitorProcesses() {
    // 这里应该集成实际的进程监控
    console.log("监控进程...");
  }

  // 检测风险（调用API）
  async detectRisk(target, content) {
    this.window.setState("yellow");
    console.log("正在检测...");

    try {
      // 调用一鉴到底API
      const result = await this.callAPI("detect", { target, content });

      if (result.hasRisk) {
        this.window.setState("red");
        this.showConfirmDialog(result);
        this.onRiskDetected(result);
      } else {
        this.window.setState("green");
      }

      return result;
    } catch (error) {
      console.error("检测失败:", error);
      this.window.setState("green");
      return { hasRisk: false };
    }
  }

  // 显示确认对话框
  showConfirmDialog(risk) {
    console.log("\n========================================");
    console.log("⚠️  发现风险操作！");
    console.log("========================================");
    console.log(`风险类型: ${risk.type}`);
    console.log(`风险等级: ${risk.level}`);
    console.log(`风险描述: ${risk.description}`);
    console.log("========================================");
    console.log("请选择操作:");
    console.log("1. 允许 (Allow)");
    console.log("2. 拒绝 (Block)");
    console.log("3. 查看 (View)");
    console.log("========================================\n");

    // 这里应该弹出实际的确认对话框
    // 在Electron中可以使用 dialog.showMessageBox()
  }

  // 调用API
  async callAPI(action, params) {
    // 这里应该调用实际的API
    console.log(`调用API: ${action}`, params);

    // 模拟API响应
    return {
      hasRisk: Math.random() > 0.7,
      type: "hardcoded_key",
      level: "high",
      description: "检测到硬编码密钥"
    };
  }

  // 用户确认
  userConfirm(action) {
    console.log(`用户选择: ${action}`);

    if (action === "allow") {
      console.log("✓ 已允许操作");
    } else if (action === "block") {
      console.log("✗ 已阻止操作");
    }

    this.window.setState("green");
  }
}

// 使用示例
const pet = new PetManager({
  name: "小鉴",
  position: { x: 100, y: 100 },
  onStateChange: (state) => {
    console.log(`状态变更: ${state}`);
  },
  onRiskDetected: (risk) => {
    console.log(`发现风险: ${risk.type}`);
  }
});

// 模拟检测场景
console.log("\n========== 测试场景 ==========\n");

// 场景1：正常操作
console.log("场景1：正常操作");
pet.detectRisk("clipboard", "normal text");

// 场景2：风险操作（延迟执行）
setTimeout(() => {
  console.log("\n场景2：风险操作");
  pet.detectRisk("file", "API_KEY = 'sk-xxxxx'");
}, 2000);

// 场景3：用户确认（延迟执行）
setTimeout(() => {
  pet.userConfirm("block");
}, 4000);

console.log("\n==============================\n");

// 导出模块
module.exports = PetManager;