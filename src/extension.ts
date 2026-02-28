import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 记录：当前文件 URI -> 备份文件路径 (用于放弃修改时还原)
const backupMap = new Map<string, string>();

export function activate(context: vscode.ExtensionContext) {
    // 创建状态栏按钮
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'aiDiff.start';
    statusBarItem.text = `$(diff) AI Diff`;
    statusBarItem.tooltip = '点击运行 AI Diff (快捷键: Alt+D)';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);


    // --- 1. 启动 Diff (支持选中部分替换) ---
let startDisposable = vscode.commands.registerCommand('aiDiff.start', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const currentDoc = editor.document;
    const currentUri = currentDoc.uri;
    const selection = editor.selection;
    
    // 始终备份【全文】，这样 Diff 才能对齐
    const fullOriginalContent = currentDoc.getText();

    let aiContent = ""; 
    try {
        aiContent = await vscode.env.clipboard.readText();
    } catch (e) {
        vscode.window.showErrorMessage('无法读取剪贴板内容');
        return;
    }

    // 创建临时备份文件 (存放全文)
    const fileExt = path.extname(currentUri.fsPath);
    const fileName = path.basename(currentUri.fsPath, fileExt);
    const backupFilePath = path.join(os.tmpdir(), `[Old]_${fileName}_${Date.now()}${fileExt}`);

    fs.writeFileSync(backupFilePath, fullOriginalContent, 'utf8');
    const backupUri = vscode.Uri.file(backupFilePath);
    backupMap.set(currentUri.fsPath, backupFilePath);

    // 执行替换
    const isPartial = !selection.isEmpty;
    const replaceRange = isPartial 
        ? new vscode.Range(selection.start, selection.end) 
        : new vscode.Range(0, 0, currentDoc.lineCount, 0);

    await editor.edit(editBuilder => {
        editBuilder.replace(replaceRange, aiContent);
    });

    // 打开 Diff：现在左右两边都是全文，差异点会被精确高亮
    await vscode.commands.executeCommand('vscode.diff', backupUri, currentUri, 'Original ↔ AI Modified');
});

    // --- 2. 放弃修改 (还原) ---
    // 如果用户反悔了，想恢复到备份的状态
    let discardDisposable = vscode.commands.registerCommand('aiDiff.discard', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }

        // 获取当前活动编辑器的文件路径（可能是 Diff 的右侧）
        const currentFsPath = editor.document.uri.fsPath;
        const backupFilePath = backupMap.get(currentFsPath);

        if (backupFilePath && fs.existsSync(backupFilePath)) {
            // 读取备份内容
            const backupContent = fs.readFileSync(backupFilePath, 'utf8');
            
            // 恢复内容
            const fullRange = new vscode.Range(0, 0, editor.document.lineCount, 0);
            await editor.edit(editBuilder => {
                editBuilder.replace(fullRange, backupContent);
            });

            // 关闭 Diff 窗口 (通过关闭当前编辑器)
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
            
            vscode.window.showInformationMessage('已还原为原始代码');
            
            // 清理
            try { fs.unlinkSync(backupFilePath); } catch(e){}
            backupMap.delete(currentFsPath);
        } else {
            vscode.window.showInformationMessage('当前文件没有对应的 AI Diff 备份记录，无法通过插件还原 (请尝试 Ctrl+Z)。');
        }
    });

    // --- 3. 完成/清理 (可选) ---
    // 其实直接关闭窗口就行，但提供一个命令来清理临时文件
    let acceptDisposable = vscode.commands.registerCommand('aiDiff.accept', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const currentFsPath = editor.document.uri.fsPath;
            const backupFilePath = backupMap.get(currentFsPath);
            
            // 只需要清理备份记录和文件，不需要额外保存操作（假设用户已经 Ctrl+S 了）
            if (backupFilePath) {
                try { if (fs.existsSync(backupFilePath)) fs.unlinkSync(backupFilePath); } catch(e){}
                backupMap.delete(currentFsPath);
            }
            // 关闭 Diff 窗口
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        }
    });

    context.subscriptions.push(startDisposable, discardDisposable, acceptDisposable);
}

// 辅助函数：更新后的说明书
function showUserGuide() {
    const panel = vscode.window.createWebviewPanel('aiDiffGuide', 'AI Diff 使用指南 v2', vscode.ViewColumn.One, {});
    panel.webview.html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: "Segoe UI", sans-serif; padding: 20px; color: var(--vscode-editor-foreground); background-color: var(--vscode-editor-background); }
        h2 { color: var(--vscode-textLink-foreground); }
        code { background-color: var(--vscode-textBlockQuote-background); padding: 2px 5px; border-radius: 3px; font-family: Consolas, monospace; }
        .step { margin-bottom: 20px; padding: 15px; border: 1px solid var(--vscode-widget-border); border-radius: 5px; }
    </style>
</head>
<body>
    <h1>⚡ AI Diff Helper (新模式)</h1>
    <div class="step">
        <h2>工作流</h2>
        <ol>
            <li><strong>复制 AI 代码</strong>：在 ChatGPT 等处复制。</li>
            <li><strong>启动 (Alt+D)</strong>：
                <ul>
                    <li>插件会<strong>立即</strong>将 AI 代码写入你当前的文件。</li>
                    <li>同时将你原来的代码保存为<strong>临时备份</strong>。</li>
                    <li>打开对比视图：<strong>左边是备份(旧)，右边是当前文件(新)</strong>。</li>
                </ul>
            </li>
            <li><strong>修改与保存</strong>：
                <ul>
                    <li>你现在编辑的直接就是源文件。</li>
                    <li>随时按 <strong>Ctrl + S</strong> 保存文件，想保存几次都可以。</li>
                </ul>
            </li>
        </ol>
    </div>
    <div class="step">
        <h2>常用命令</h2>
        <ul>
            <li><code>AI Diff: Discard (Revert)</code> - 后悔了？一键把文件还原成备份内容。</li>
            <li><code>Ctrl + Z</code> - 因为是直接写入编辑器，你也可以使用 VSCode 原生的撤销功能。</li>
        </ul>
    </div>
</body>
</html>`;
}

export function deactivate() {
    // 插件关闭时，尝试清理所有残留的临时文件
    backupMap.forEach((tempPath) => {
        try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch(e){}
    });
}