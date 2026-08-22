# 调研报告：秋招投递记录系统

> 状态：全新项目（greenfield），无既有代码库。本文档记录需求约束与开发环境调研结果，是 Phase 2 技术选型的输入。

## 1. 项目概述

秋招投递记录系统：记录并跟踪 2026 秋招期间各公司/岗位的投递与进展状态的桌面小工具。

## 2. 硬性约束（来自需求方）

- 运行平台：macOS + Windows 双平台
- 界面简洁
- 本地运行，不联网
- 轻巧：体积小、启动快、依赖少

## 3. 环境调研

### 3.1 Mac（主力开发机，已实测）

| 项 | 结果 |
|---|---|
| 系统 | macOS 26.5.1，arm64（Apple Silicon） |
| Python | 3.14.6 ✅（但 **tkinter 不可用**，import 即报错） |
| Node.js | v26.3.0 ✅ |
| Go | 1.23.12 ✅（纯 Go 程序可从 Mac 交叉编译出 Windows exe） |
| Rust/Cargo | ❌ 未安装 |

### 3.2 Windows（运行机，用户确认）

- 有 Python（具体版本待确认）
- 无其他开发环境信息

### 3.3 项目位置

`~/Desktop/qiuzhao-tracker`（用户确认）

## 4. 候选技术方向初探（仅梳理格局，未做决策）

| 方向 | 与约束的匹配度 | 备注 |
|---|---|---|
| Python + PySide6/PyQt6 桌面 GUI | 双平台可跑源码；界面现代 | 打包后体积偏大；PyInstaller 需各平台分别打包 |
| Python 本地 Web（本地服务 + 浏览器 UI） | localhost 不算联网；UI 灵活 | 使用体验依赖浏览器；需处理启动方式/端口 |
| 单文件 HTML（纯前端 + localStorage） | 最轻、零安装、双平台零成本 | 数据在浏览器内，需导入/导出做兜底 |
| Go + 本地 HTTP + 浏览器 UI | 产出单一 exe，可从 Mac 交叉编译 Windows 版 | Go GUI 库依赖 CGO、交叉编译受限，走浏览器 UI 可绕开 |
| ~~Python + Tkinter~~ | 本机 Python 无 tkinter | 基本排除（除非额外安装 python-tk） |
| ~~Electron~~ | 体积 100MB+，与"轻巧"冲突 | 排除 |
| ~~Tauri~~ | 需要 Rust 工具链，本机未装 | 暂不选（除非愿意安装 Rust） |

## 5. 结论与下一步

- 无明显技术障碍。Windows 也有 Python，Python 系方案可以"两边跑源码"起步，打包成本极低。
- 技术栈及所有具体设计决策（数据字段、功能范围、存储方式等）将在 Phase 2 中逐一确认。
