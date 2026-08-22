# 秋招投递记录系统

本地、离线、轻量的秋招投递进度管理工具。Python + Flask + SQLite，浏览器单页界面，无外部依赖（无 CDN）。

## 快速开始

### Mac

```bash
# 首次：安装依赖（仅一次，需联网）
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

# 之后每次：双击 start.command，或：
./start.command
```

### Windows

```bat
:: 首次：安装依赖（仅一次，需联网）
python -m venv .venv && .venv\Scripts\pip install -r requirements.txt
:: 或全局安装：pip install flask

:: 之后每次：双击 start.bat
```

启动后浏览器自动打开 http://127.0.0.1:8765 ，关闭命令行窗口即停止服务。

## 使用

- **+ 新建投递**：公司、岗位必填；点表格行 / 看板卡片打开编辑弹层。
- **进展记录**：在弹层下方添加笔试/面试的时间和备注（如会议链接）。
- **看板**：拖拽卡片即可改状态；表格/看板一键切换，筛选对两者同时生效。
- **近 7 天待办**：左栏自动列出，24 小时内红色、3 天内橙色。
- **统计条**：点状态卡片可快速按该状态筛选，再点一次取消。

## 数据与备份

所有数据在单个文件 `data/tracker.db`。
备份 = 复制这个文件；迁移到另一台电脑 = 复制整个项目文件夹（含 `data/`）。

## 端口

默认 8765。被占用时换端口：Mac `PORT=9000 ./start.command`；Windows `set PORT=9000` 后运行 `start.bat`。

## Mac → Windows 迁移验收清单

1. 复制整个项目文件夹到 Windows
2. 执行上方 Windows 依赖安装（一次）
3. 双击 `start.bat`，浏览器自动打开页面
4. 原有记录完整显示（前提是 `data/` 一并拷过来了）
5. 新建 / 编辑 / 删除一条记录
6. 给记录添加一条进展，确认左栏待办出现
7. 看板视图拖拽卡片改状态
8. 关闭命令行窗口、重新双击启动，数据仍在
