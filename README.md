# AI Diff Helper

一个极简的 VS Code 扩展，专为 "AI 编程" 工作流设计。
它可以帮你快速将 ChatGPT/Claude 生成的代码应用到当前文件，同时提供 Diff 视图让你安全地进行审查和修改。

## ✨ 核心特性

*   **⚡ 极速应用**: 按下 `Ctrl + Alt + D`，剪贴板里的 AI 代码立即写入当前文件。
*   **🛡️ 安全备份**: 在写入的同时，自动将你的旧代码保存为临时备份。
*   **👀 实时对比**: 自动打开 Diff 视图（左侧为旧代码备份，右侧为当前新代码）。
*   **↩️ 轻松回滚**: 不满意？一键执行 `Discard` 命令还原文件，或者直接使用 VS Code 的撤销 (Ctrl+Z)。

## 🚀 快速开始

1.  **复制**: 在 ChatGPT/DeepSeek 等网页端复制生成的代码。
2.  **启动**: 回到 VS Code，打开你要修改的文件，按下快捷键：
    *   Windows/Linux: `Ctrl + Alt + D`
    *   Mac: `Cmd + Alt + D`
3.  **审查与保存**:
    *   插件会将新代码写入当前文件，并打开对比窗口。
    *   你依然是在编辑**原文件**。觉得没问题，直接 `Ctrl + S` 保存即可。
    *   左侧的旧代码仅供参考。

## ⚙️ 命令

按 `F1` 或 `Ctrl+Shift+P` 输入以下命令：

*   `AI Diff: Start`: 启动粘贴与对比。
*   `AI Diff: Discard (Revert)`: 放弃修改，将文件还原为备份状态。
*   `AI Diff: Accept & Clear`: (可选) 关闭对比窗口并清理临时备份。
*   `AI Diff: Show Guide`: 查看使用教程。

## 🔗 链接

*   [GitHub 仓库](你的GitHub地址)
*   [问题反馈](你的GitHub地址/issues)

**Enjoy coding with AI!**