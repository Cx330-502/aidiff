import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 记录：当前文件 URI -> 备份文件路径 (用于放弃修改时还原)
const backupMap = new Map<string, string>();

export function activate(context: vscode.ExtensionContext) {

    // --- 0. 首次引导 (同旧版，稍作保留) ---
    const GUIDE_KEY = 'aiDiff.hasShownGuide.v2'; // 升级版本号，让用户重看新教程
    if (!context.globalState.get(GUIDE_KEY)) {
        setTimeout(() => {
            showUserGuide();
            context.globalState.update(GUIDE_KEY, true);
        }, 1000);
    }
    context.subscriptions.push(vscode.commands.registerCommand('aiDiff.showGuide', () => showUserGuide()));


    // --- 1. 启动 Diff (核心逻辑重写) ---
    let startDisposable = vscode.commands.registerCommand('aiDiff.start', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个代码文件');
            return;
        }

        const currentDoc = editor.document;
        const currentUri = currentDoc.uri;
        
        if (currentUri.scheme === 'untitled') {
            vscode.window.showWarningMessage('请先保存当前文件到硬盘，然后再使用此功能。');
            return;
        }

        // 1. 获取内容
        const originalContent = currentDoc.getText(); // 这是你的旧代码
        let aiContent = ""; 
        
        try {
            aiContent = await vscode.env.clipboard.readText(); // 这是 AI 代码
        } catch (e) {
            vscode.window.showErrorMessage('无法读取剪贴板内容');
            return;
        }

        if (!aiContent.trim()) {
            vscode.window.showWarningMessage('剪贴板为空，无法进行替换');
            return;
        }

        // 2. 创建临时备份文件 (存放 Old Code)
        const fileExt = path.extname(currentUri.fsPath);
        const fileName = path.basename(currentUri.fsPath, fileExt);
        const tempDir = os.tmpdir();
        // 命名格式：Original_Backup_文件名.ext
        const backupFileName = `[Backup]_${fileName}_${Date.now()}${fileExt}`;
        const backupFilePath = path.join(tempDir, backupFileName);

        try {
            fs.writeFileSync(backupFilePath, originalContent, 'utf8');
        } catch (err) {
            vscode.window.showErrorMessage(`无法创建备份文件: ${err}`);
            return;
        }

        const backupUri = vscode.Uri.file(backupFilePath);
        
        // 记录映射关系，方便后续“放弃修改”
        backupMap.set(currentUri.fsPath, backupFilePath);

        // 3. 将 AI 代码直接写入当前编辑器 (支持 Ctrl+Z 撤销)
        const fullRange = new vscode.Range(0, 0, currentDoc.lineCount, 0);
        const editSuccess = await editor.edit(editBuilder => {
            editBuilder.replace(fullRange, aiContent);
        });

        if (!editSuccess) {
            vscode.window.showErrorMessage('写入 AI 代码失败，文件可能只读');
            return;
        }

        // 4. 打开 Diff：左边是备份(Old)，右边是当前文件(New/AI)
        // 用户直接在右边修改，按 Ctrl+S 就是保存文件本身
        const title = `Backup (Read-only) ↔ Current File (Editable)`;
        
        await vscode.commands.executeCommand('vscode.diff', backupUri, currentUri, title);
        
        vscode.window.setStatusBarMessage(`AI Diff: 已应用新代码。左侧为备份，右侧为当前文件。满意请直接保存。`, 5000);
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
            <li><strong>启动 (Ctrl+Alt+D)</strong>：
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