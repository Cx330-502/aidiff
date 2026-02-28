# Change Log

All notable changes to the "aidiff" extension will be documented in this file.

## [Unreleased]

## [0.0.5]
- **快捷键更新**: 将默认快捷键修改为 `Alt + D`，以提供更直观的操作体验。
- **选区替换优化**: 当用户选中部分代码时，旧文本窗口现在显示整个旧文件内容，而不是仅显示选中部分。这使得用户在对比时能够更全面地了解修改前后的差异。

## [0.0.4]

### Added

- **局部替换核心功能 (Partial Replacement)**: 现在，如果用户在运行命令前选中了部分代码，扩展将只会替换被选中的这部分内容。如果没有选中任何代码，则保持原有的全文替换逻辑。这大大提升了操作的灵活性和精确性。

### Changed

- **优化 (Optimization)**: 压缩了扩展的图标文件 `icon.png`，减小了扩展的整体体积。

## [0.0.1]

### Added

- **初始版本 (Initial Release)**:
  - 核心功能：从剪贴板粘贴 AI 生成的代码并自动打开 Diff 视图。
  - 支持全文替换。
  - 提供 `AI Diff: Start`, `AI Diff: Discard (Revert)`, `AI Diff: Accept & Clear` 等核心命令。