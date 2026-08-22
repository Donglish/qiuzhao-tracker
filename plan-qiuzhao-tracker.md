# 秋招投递记录系统 v1 实施计划

## 1. 背景与目标

### 1.1 业务背景

用户正在 2026 秋招，投递量会达到几十到几百条，需要一个工具记录每家公司的投递与进展（笔试、各轮面试、offer/拒信）。先在 Mac 上使用几天，之后长期只在 Windows 使用（一次性迁移，非双机并行）。

### 1.2 目标

做一个**本地、离线、轻量、界面简洁**的投递记录系统：

- 录入/管理投递记录与每轮笔试面试进展
- 一眼看清整体进展（统计）与近期安排（待办）
- 表格 + 看板两种视图
- 双击即可启动，Mac → Windows 迁移只需拷贝文件夹

### 1.3 非目标（v1 明确不做）

- 浏览器插件 / 自动抓取招聘信息（全部手动录入）
- 简历管理
- 联网同步 / 账号 / 多用户（手机查看需求经讨论后放弃：局域网方案需电脑常驻开机，性价比不足）
- 邮件、日历集成；移动端
- 数据导入导出（备份 = 直接拷 `data/` 目录）
- 打包 exe（源码 + 启动脚本交付）

## 2. 技术选型（现状分析 · Scenario C）

候选对比详见 `research.md` 第 4 节，结论：

- **选定：Python 3 + Flask + SQLite（stdlib sqlite3）+ 浏览器单页 UI（无框架、无 CDN）**
- 理由：双机已有 Python，零构建、迁移只需拷文件夹；SQLite 单文件天然便携；浏览器 UI 最易做"简洁"且双平台一致。
- 已排除：Tkinter（本机 Python 无 Tk）、Electron（重）、Tauri（无 Rust）、单文件 HTML（localStorage 数据不安全）、PySide6（依赖体积大）、Go（迭代效率低）。
- 关键能力边界：Flask 只用于本地 localhost 服务；前端不引用任何 CDN 资源（离线约束）；数据量为百级，全量读取 + 前端内存筛选即可，无需分页/索引优化。

## 3. 实施设计

### 3.1 高层设计

```
浏览器（单页 UI：HTML + CSS + 原生 JS，全部本地文件）
   │  fetch /api/...（JSON）
Flask 服务（app.py：路由 + 校验；db.py：连接与建表）
   │  sqlite3
data/tracker.db（唯一数据文件，备份/迁移 = 拷它）
```

启动：`start.command`（Mac）/ `start.bat`（Windows）→ 运行 `app.py` → Flask 监听 127.0.0.1:8765 → 自动打开浏览器。

### 3.2 详细设计

#### 数据模型（data/tracker.db，首次启动自动建表）

```sql
CREATE TABLE IF NOT EXISTS applications (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  company      TEXT NOT NULL,                 -- 公司，必填
  position     TEXT NOT NULL,                 -- 岗位，必填
  city         TEXT NOT NULL DEFAULT '',      -- 工作城市
  channel      TEXT NOT NULL DEFAULT '',      -- 投递渠道（建议值：官网/内推/BOSS直聘/牛客/宣讲会，自由文本+datalist）
  applied_date TEXT NOT NULL DEFAULT '',      -- 投递日期 YYYY-MM-DD
  status       TEXT NOT NULL DEFAULT '已投递', -- 固定六值：已投递/笔试/面试/offer/已拒/搁置
  link         TEXT NOT NULL DEFAULT '',      -- 岗位链接
  notes        TEXT NOT NULL DEFAULT '',      -- 备注
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL                  -- 最近更新（列表排序用）
);

CREATE TABLE IF NOT EXISTS events (           -- 进展子表：一条投递挂多条进展
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  type           TEXT NOT NULL,               -- 建议值：笔试/一面/二面/三面/HR面/其他（自由文本+datalist）
  event_time     TEXT NOT NULL,               -- YYYY-MM-DDTHH:MM（本地时间）
  notes          TEXT NOT NULL DEFAULT '',    -- 地点/会议链接/面经等
  created_at     TEXT NOT NULL
);
```

关键决策：**状态手动维护**（下拉直接改），不由 events 自动流转——规则交给用户，逻辑最简单。删除记录级联删其 events。

#### 后端 API（Flask，返回 JSON）

数据量小，约定：**`GET /api/applications` 一次返回全部记录（内嵌各自 events 数组）**，搜索/筛选/排序/统计/待办全部在前端内存中完成；任何写操作后前端重新全量拉取。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/` | 返回单页 index.html |
| GET | `/api/applications` | 全量列表（含嵌套 events） |
| POST | `/api/applications` | 新建记录（company/position 必填校验） |
| PUT | `/api/applications/<id>` | 更新记录字段（含状态） |
| DELETE | `/api/applications/<id>` | 删除记录（级联删 events） |
| POST | `/api/applications/<id>/events` | 给记录加一条进展 |
| PUT | `/api/events/<id>` | 改进展（时间/类型/备注） |
| DELETE | `/api/events/<id>` | 删进展 |

#### 前端（templates/index.html + static/app.js + static/style.css）

单页三段式布局：

```
┌─────────────────────────────────────────┐
│ 统计条：总投递 | 笔试 | 面试 | offer | 已拒 | 本周新增 │  ← 纯数字卡片，点击状态卡片=按该状态筛选
├───────────┬─────────────────────────────┤
│ 近7天待办   │ [表格|看板]切换  搜索框  状态/渠道筛选  │
│ （按时间升序）│                             │
│ ·24h内 红色 │  表格：行=记录，点击开详情弹层        │
│ ·3天内 橙色 │  看板：按状态分列，卡片可拖拽改状态     │
│ 点击→详情   │                             │
└───────────┴─────────────────────────────┘
```

- **详情弹层**：字段表单（可编辑保存）+ 进展时间线 + 添加进展表单（类型/时间/备注）。
- **统计口径**：offer 率 = offer 数 ÷ 总投递数；本周新增 = created_at 在近 7 天内。
- **临期高亮**：以 `event_time` 与当前时间比较，<24h 红、<72h 橙；仅展示未来 7 天内的待办。
- **空状态**：无数据时显示引导文案；所有删除操作前端二次确认。
- 样式手写 CSS（无框架无 CDN），配色素雅，中文界面。

#### 启动脚本

- `start.command`：`#!/bin/zsh`，`cd "$(dirname "$0")"` 后 `python3 app.py`；交付时 `chmod +x`。
- `start.bat`：`chcp 65001`（防中文乱码）→ `cd /d %~dp0` → `python app.py`（失败则提示安装 Python/加 PATH）。
- 浏览器自动打开由 `app.py` 内 `webbrowser.open` 完成（延迟 1s 等 Flask 起来）；关闭命令行窗口即停止服务。

## 4. 分步实施

### 4.1 Step 1：项目骨架

建目录与空文件：`app.py`、`db.py`、`templates/index.html`、`static/app.js`、`static/style.css`、`requirements.txt`（`flask`）、`start.command`、`start.bat`、`README.md`。写两个启动脚本。

### 4.2 Step 2：数据层（db.py）

连接工厂（`sqlite3.Row`）、`init_db()` 执行 3.2 的建表 SQL、查询辅助（行转 dict、按 application 聚合 events）。

### 4.3 Step 3：后端 API（app.py）

实现 8 个路由；写入前校验必填与非空；`updated_at` 每次写操作刷新；`webbrowser` 自动打开；端口 8765，被占用时打印明确提示（可用 `PORT` 环境变量覆盖）。

### 4.4 Step 4：表格视图 + 详情弹层 + 记录/进展 CRUD

先让核心录入闭环可用：列表渲染、搜索筛选排序、弹层编辑、进展时间线增删改。

### 4.5 Step 5：看板视图

按状态六列渲染卡片，HTML5 拖拽改状态（drop 时调 PUT），与表格视图一键切换，筛选条件对两个视图同时生效。

### 4.6 Step 6：统计条 + 待办栏 + 临期高亮

数字卡片、近 7 天待办升序列表、24h/72h 双色高亮、点击联动。

### 4.7 Step 7：自测 + 文档

Mac 实测黄金路径与边界（空数据/特殊字符/长备注/跨视图联动）；README 写启动方法、Mac→Windows 迁移步骤、Windows 验收清单。

## 5. 配置与部署

- 依赖：`pip install flask`（双机各一次；安装时需联网，之后运行完全离线）。
- 环境变量：`PORT`（默认 8765）。
- 首次运行自动创建 `data/tracker.db`。
- 迁移 Windows：拷整个项目文件夹 → `pip install flask` → 双击 `start.bat`。

## 6. 变更清单

| 文件 | 说明 |
|---|---|
| `app.py` | 新建：Flask 服务与 8 个 API 路由 |
| `db.py` | 新建：连接、建表、行转 dict、聚合查询 |
| `templates/index.html` | 新建：单页结构（统计条/待办栏/表格/看板/弹层） |
| `static/app.js` | 新建：拉取数据、渲染、筛选排序、CRUD 调用、拖拽 |
| `static/style.css` | 新建：手写简洁样式，无外部依赖 |
| `requirements.txt` | 新建：`flask` |
| `start.command` / `start.bat` | 新建：双平台双击启动脚本 |
| `README.md` | 新建：启动、迁移、Windows 验收清单 |
| `data/` | 运行时生成（tracker.db），不进版本管理 |
| `research.md` / `plan-qiuzhao-tracker.md` | 流程文档，已存在 |

## 7. 关键考量

- **数据安全**：唯一数据文件 `data/tracker.db`，备份=拷贝；删除全部二次确认；`ON DELETE CASCADE` 防孤儿进展。
- **中文乱码**：SQLite UTF-8；`start.bat` 先 `chcp 65001`；HTML `<meta charset="utf-8">`。
- **端口占用**：8765 被占时给出明确提示并支持 `PORT` 覆盖。
- **离线约束**：不引任何 CDN/外部字体，Flask 是唯一第三方依赖。
- **Windows 差异**：路径分隔、`python` vs `py` 命令、`.bat` 编码——验收清单覆盖。
- **已否方案**：PySide6（体积大）、单文件 HTML（localStorage 不安全）、Go（迭代慢）、FastAPI（过重）、自动状态流转（规则交给用户更稳）。

## Todo

### Stage 1：骨架与数据层

- [x] 创建项目骨架文件（requirements.txt、目录结构）
- [x] db.py：连接工厂、init_db 建表、查询辅助
- [x] start.command / start.bat 启动脚本

### Stage 2：后端 API

- [x] app.py：8 个路由、必填校验、自动打开浏览器、端口占用提示

### Stage 3：前端

- [x] index.html：三段式结构 + 详情弹层表单
- [x] style.css：布局与样式（无框架无 CDN）
- [x] app.js：数据流 + 表格视图 + 详情弹层 + 记录/进展 CRUD
- [x] app.js：看板视图 + 拖拽改状态
- [x] app.js：统计条 + 待办栏 + 临期高亮

### Stage 4：验证与文档

- [x] 安装 Flask，启动服务（系统 Python 为 PEP 668  externally-managed，改用项目内 .venv）
- [x] API 自测（黄金路径 + 边界：空数据/必填缺失/特殊字符）——19 项全部通过
- [x] 页面加载验证（页面/API/静态文件均 200；交互细节以用户浏览器实测为准）
- [x] README.md（启动方法、迁移步骤、Windows 验收清单）
