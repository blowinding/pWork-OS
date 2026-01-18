# pWork-OS

> Personal Work Operating System - A Git-first work management system for developers and researchers

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://www.typescriptlang.org/)

---

## 📖 项目简介

pWork-OS 是一个专为**开发者和研究人员**设计的个人工作管理系统，旨在替代 Notion 在工程/科研场景下的核心能力。它采用 **Git-first** 设计理念，所有数据以 **Markdown + YAML** 格式存储，深度集成 GitHub，支持自动生成周报和演示文稿。

### 核心特性

- ✅ **每日工作记录（Daily Log）**
  自动生成日志模板，支持关联项目、标签系统，按日期/项目/标签查询

- 📊 **周报自动聚合（Weekly Report）**
  从每日日志自动汇总周报，提取重点内容，支持导出 Slides

- 🚀 **项目管理（Project System）**
  一个项目对应一个 GitHub Repo，支持项目状态跟踪、GitHub 数据同步

- 🔗 **GitHub 深度集成**
  自动同步 Issues、PRs、Milestones，查看项目 GitHub 统计数据

- 🎨 **本地 Web 查看器（Viewer）**
  启动本地服务器，在浏览器中查看时间线、周报、项目列表

- 📽️ **Slides 自动生成**
  基于 reveal.js 将 Markdown 转换为演示文稿（HTML/PDF），支持自定义样式

- 💾 **数据完全可控**
  所有数据本地化、文本化、可版本管理、可审计、可迁移

---

## 🚀 快速开始

### 系统要求

- Node.js >= 20.0.0
- Git
- (可选) GitHub Personal Access Token（用于 GitHub 集成）
- (可选) reveal-md（用于 Slides 导出，通过 npx 自动调用）

### 安装

```bash
# 克隆仓库
git clone https://github.com/your-username/pWork-OS.git
cd pWork-OS

# 安装依赖
npm install

# 构建项目
npm run build

# 全局安装 CLI 工具（可选）
npm link
```

### 初始化工作空间

```bash
# 创建并初始化一个新的工作空间
pwork init ~/my-workspace

# 带模板文件的初始化
pwork init ~/my-workspace --templates

# 指定工作空间名称
pwork init ~/my-workspace --name "My Work"
```

初始化后，会创建以下目录结构：

```
my-workspace/
├── daily/                   # 每日工作记录
├── weekly/                  # 周报
├── projects/                # 项目索引
├── templates/               # 模板文件（使用 --templates 选项）
│   ├── daily.md
│   ├── weekly.md
│   ├── project.md
│   └── reveal-custom.css    # Slides 自定义样式
├── slides/                  # 生成的演示文稿
└── .pwork.json              # 工作空间配置
```

---

## 📝 使用说明

### 1. 配置管理

#### 设置 GitHub Token

```bash
# 设置 GitHub Personal Access Token
pwork config set-token ghp_xxxxxxxxxxxx

# 查看 Token（掩码显示）
pwork config get-token

# 或通过环境变量
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
export GH_TOKEN=ghp_xxxxxxxxxxxx
```

#### 设置默认工作空间

```bash
# 设置默认工作空间
pwork config set-workspace ~/my-workspace

# 查看默认工作空间
pwork config get-workspace
```

#### 查看所有配置

```bash
# 人类可读格式
pwork config show

# JSON 格式
pwork config show --json

# 查看配置文件路径
pwork config path
```

#### 重置配置

```bash
# 重置全局配置（需要确认）
pwork config reset --confirm
```

---

### 2. 每日工作记录

#### 创建 Daily Log

```bash
# 创建今天的日志
pwork daily new

# 创建指定日期的日志
pwork daily new 2026-01-15

# 创建时关联项目和标签
pwork daily new --project my-project --tag experiment

# 创建后立即在编辑器中打开
pwork daily new --edit
```

#### 快速打开今天的日志

```bash
# 获取或创建今天的日志
pwork daily today

# 在编辑器中打开
pwork daily today --edit
```

#### 查看 Daily Log

```bash
# 查看今天的日志
pwork daily show

# 查看指定日期的日志
pwork daily show 2026-01-15
```

#### 编辑 Daily Log

```bash
# 编辑今天的日志
pwork daily edit

# 编辑指定日期的日志
pwork daily edit 2026-01-15
```

#### 列出和查询 Daily Log

```bash
# 列出最近 10 条日志（默认）
pwork daily list

# 列出最近 20 条
pwork daily list --limit 20

# 按项目筛选
pwork daily list --project my-project

# 按标签筛选
pwork daily list --tag experiment

# 只显示周报重点
pwork daily list --highlight

# 按日期范围查询
pwork daily list --from 2026-01-01 --to 2026-01-15

# 组合条件查询
pwork daily list --project my-project --from 2026-01-01 --limit 30
```

#### 管理项目和标签

```bash
# 添加项目到日志
pwork daily add-project 2026-01-15 my-project

# 添加标签
pwork daily add-tag 2026-01-15 experiment

# 设置为周报重点
pwork daily highlight 2026-01-15 on

# 取消周报重点
pwork daily highlight 2026-01-15 off

# 切换周报重点状态
pwork daily highlight 2026-01-15
```

#### 统计信息

```bash
# 查看统计数据
pwork daily stats
```

输出示例：
```
Daily Log Statistics:

  Total:          45
  This Week:      5
  This Month:     18
  Highlights:     8

  Projects:
    project-a: 25
    project-b: 12

  Tags:
    #experiment: 15
    #meeting: 10
```

#### 删除 Daily Log

```bash
# 删除日志（需要 --force 确认）
pwork daily delete 2026-01-15 --force
```

---

### 3. 周报管理

#### 创建周报

```bash
# 创建本周周报（手动填写）
pwork weekly new

# 创建本周周报（自动聚合 Daily Logs）
pwork weekly new --aggregate

# 创建指定周的周报
pwork weekly new 2026-W02

# 创建后在编辑器中打开
pwork weekly new --aggregate --edit
```

#### 生成/更新周报

```bash
# 从 Daily Logs 生成本周周报
pwork weekly generate

# 生成指定周的周报
pwork weekly generate 2026-W02

# 生成后立即编辑
pwork weekly generate --edit
```

`generate` 命令会：
- 自动聚合该周的所有 Daily Logs
- 提取标记为 `weekly_highlight` 的内容
- 统计项目进展
- 如果周报已存在，会保留用户编辑的部分并更新聚合内容

#### 查看周报

```bash
# 查看本周周报
pwork weekly show

# 查看指定周的周报
pwork weekly show 2026-W02
```

#### 编辑周报

```bash
# 编辑本周周报
pwork weekly edit

# 编辑指定周的周报
pwork weekly edit 2026-W02
```

#### 列出周报

```bash
# 列出最近 10 周的周报
pwork weekly list

# 列出最近 20 周
pwork weekly list --limit 20
```

#### 查看周的 Daily Logs

```bash
# 查看本周的所有 Daily Logs
pwork weekly dailies

# 查看指定周的 Daily Logs
pwork weekly dailies 2026-W02
```

输出示例：
```
Daily Logs for 2026-W03 (2026-01-13 ~ 2026-01-19):

★ 2026-01-15 [project-a]
  2026-01-16 [project-a, project-b]
★ 2026-01-17 [project-b]

Total: 3 daily log(s), 2 highlight(s)
```

#### 统计信息

```bash
# 查看周报统计
pwork weekly stats
```

#### 删除周报

```bash
# 删除周报（需要 --force 确认）
pwork weekly delete 2026-W02 --force
```

---

### 4. 项目管理

#### 创建项目

```bash
# 创建项目（必须提供 GitHub 仓库）
pwork project new "PIFO Scheduler" https://github.com/username/pifo-scheduler

# 指定项目类型
pwork project new "My Research" owner/repo --type research

# 指定初始状态
pwork project new "New Project" owner/repo --status Doing

# 创建后立即编辑
pwork project new "My Project" owner/repo --edit
```

支持的项目类型（`--type`）：
- `software` - 软件项目（默认）
- `research` - 科研论文
- `hybrid` - 混合型项目
- `misc` - 其他事务型项目

支持的项目状态（`--status`）：
- `Planning` - 规划中（默认）
- `Doing` - 进行中
- `Blocked` - 受阻
- `Done` - 已完成

GitHub 仓库 URL 支持多种格式：
- `https://github.com/owner/repo`
- `github.com/owner/repo`
- `owner/repo`

#### 列出项目

```bash
# 列出所有活跃项目（不包括 Done）
pwork project list

# 列出所有项目（包括 Done）
pwork project list --all

# 按状态筛选
pwork project list --status Doing

# 按类型筛选
pwork project list --type research

# 组合筛选
pwork project list --status Doing --type software
```

输出示例：
```
Projects (3):

🚀 Project Alpha [Doing] 💻 owner/alpha-repo
📋 Project Beta [Planning] 🔬 owner/beta-repo
🚫 Project Gamma [Blocked] 💻 owner/gamma-repo
```

#### 查看项目详情

```bash
# 查看项目详情
pwork project show "PIFO Scheduler"
```

输出示例：
```
💻 Project: PIFO Scheduler

  Status:      🚀 Doing
  Type:        💻 software
  GitHub:      https://github.com/username/pifo-scheduler
  Clone:       git@github.com:username/pifo-scheduler.git
  Start Date:  2026-01-01
  File:        /path/to/workspace/projects/pifo-scheduler.md
```

#### 编辑项目

```bash
# 在编辑器中打开项目文件
pwork project edit "My Project"
```

#### 管理项目状态

```bash
# 查看项目状态
pwork project status "My Project"

# 设置项目状态
pwork project status "My Project" Doing

# 快捷命令 - 开始项目
pwork project start "My Project"

# 快捷命令 - 阻塞项目
pwork project block "My Project"

# 快捷命令 - 完成项目（自动设置结束日期）
pwork project complete "My Project"

# 快捷命令 - 恢复项目（从 Blocked/Done 恢复到 Doing）
pwork project resume "My Project"
```

#### 更新项目信息

```bash
# 更新 GitHub 仓库链接
pwork project link "My Project" https://github.com/new-owner/new-repo

# 更新项目类型
pwork project type "My Project" research
```

#### GitHub 集成

**前提条件**：需要配置 GitHub Token

```bash
# 设置 GitHub Token
pwork config set-token ghp_xxxxxxxxxxxx
```

##### 同步 GitHub 数据

```bash
# 查看可同步的项目列表
pwork project sync

# 同步指定项目的 GitHub 数据
pwork project sync "My Project"

# 同步时指定筛选条件
pwork project sync "My Project" --state open

# 只同步 Issues
pwork project sync "My Project" --no-prs --no-milestones

# 只同步 PRs
pwork project sync "My Project" --no-issues --no-milestones

# 只查看统计，不更新项目文件
pwork project sync "My Project" --no-update
```

同步输出示例：
```
Syncing project: PIFO Scheduler
GitHub: username/pifo-scheduler

✓ Sync completed!

Repository:
  pifo-scheduler
  A programmable PIFO scheduler implementation
  ⭐ 45 stars | 🍴 12 forks

Issues:
  Total: 15 | Open: 8 | Closed: 7

Pull Requests:
  Total: 23 | Open: 3 | Merged: 18 | Closed: 2

Milestones:
  Total: 4 | Open: 2 | Closed: 2
```

##### 快速查看 GitHub 统计

```bash
# 快速查看项目的 GitHub 统计（不更新文件）
pwork project github "My Project"
```

输出示例：
```
PIFO Scheduler

  Repository: username/pifo-scheduler
  ⭐ Stars: 45
  📋 Open Issues: 8
```

#### 统计信息

```bash
# 查看项目统计
pwork project stats
```

输出示例：
```
Project Statistics:

  Total: 5

  By Status:
    📋 Planning: 1
    🚀 Doing: 2
    🚫 Blocked: 1
    ✅ Done: 1

  By Type:
    💻 software: 3
    🔬 research: 2
```

#### 删除项目

```bash
# 删除项目（需要 --force 确认）
pwork project delete "My Project" --force
```

---

### 5. 本地 Web 查看器

启动本地 HTTP 服务器，在浏览器中查看所有文档。

```bash
# 启动查看器（默认端口 3000）
pwork view

# 指定端口
pwork view --port 8080

# 指定主机（允许局域网访问）
pwork view --host 0.0.0.0

# 不自动打开浏览器
pwork view --no-open
```

启动后，访问 `http://localhost:3000` 可以看到：

- 🏠 **首页** - 快速导航到各个视图
- 📅 **时间线** - 按日期倒序显示所有 Daily Logs，支持预览
- 📊 **周报列表** - 所有 Weekly Reports 及日期范围
- 🚀 **项目列表** - 所有项目及状态、类型、GitHub 链接
- 📄 **文档详情** - 点击可查看具体的 Daily/Weekly/Project 内容

查看器特性：
- 响应式设计，适配移动端
- GitHub 风格的 UI
- 时间线视图带进度点
- 项目状态带颜色标识
- 自动检测文档类型并渲染元数据

---

### 6. 导出功能

#### 导出为 Slides

使用 reveal-md 将 Markdown 文档转换为 reveal.js 演示文稿。

```bash
# 从 Weekly Report 生成 Slides（HTML 格式）
pwork export slides weekly:2026-W03

# 从 Daily Log 生成 Slides
pwork export slides daily:2026-01-15

# 从 Project 生成 Slides
pwork export slides project:pifo-scheduler

# 从任意 Markdown 文件生成
pwork export slides /path/to/file.md

# 生成 PDF 格式
pwork export slides weekly:2026-W03 --format pdf

# 使用不同主题
pwork export slides weekly:2026-W03 --theme white

# 指定输出路径
pwork export slides weekly:2026-W03 --output ~/slides/week03
```

支持的格式（`--format` 或 `-f`）：
- `html` - HTML 格式（默认），输出为包含 index.html 的目录
- `pdf` - PDF 文档，输出为单个文件

支持的主题（`--theme` 或 `-t`）：
- `black` - 深色主题（默认）
- `white` - 浅色主题
- `league` - 深色带强调色
- `sky` - 天空蓝主题
- `beige` - 米色主题
- `night` - 夜间主题
- `serif` - 衬线字体主题
- `simple` - 简洁主题
- `solarized` - Solarized 配色
- `blood` - 血红主题
- `moon` - 月光主题

文档标识符格式：
- `daily:YYYY-MM-DD` - Daily Log
- `weekly:YYYY-Www` - Weekly Report
- `project:name` - Project
- 或直接使用文件路径

#### 自定义样式

系统会自动检测并使用工作空间中的 `templates/reveal-custom.css` 文件来美化演示文稿。

默认样式特性：
- 标题左上角对齐
- 响应式图片缩放
- 长内容自动分页
- 代码高亮
- 优化的排版和间距

生成的 Slides 支持：
- 代码语法高亮
- 图片自动缩放
- 列表和表格
- 响应式布局
- 键盘导航（方向键）
- 演讲者模式（HTML 格式）

---

## 🎨 模板系统

### 模板变量

创建模板文件时支持以下变量替换：

#### Daily 模板变量
- `{{DATE}}` - 日期（YYYY-MM-DD）
- `{{WEEK}}` - 周标识（YYYY-Www）
- `{{YEAR}}` - 年份
- `{{MONTH}}` - 月份
- `{{DAY}}` - 日

#### Weekly 模板变量
- `{{WEEK}}` - 周标识（YYYY-Www）
- `{{WEEK_START}}` - 周起始日期
- `{{WEEK_END}}` - 周结束日期
- `{{YEAR}}` - 年份

#### Project 模板变量
- `{{PROJECT_NAME}}` - 项目名称
- `{{GITHUB_REPO}}` - GitHub 仓库 URL
- `{{START_DATE}}` - 开始日期

### 自定义模板

您可以在工作空间的 `templates/` 目录下自定义模板：

```bash
# 初始化时复制内置模板
pwork init ~/my-workspace --templates

# 然后编辑模板
vim ~/my-workspace/templates/daily.md
vim ~/my-workspace/templates/weekly.md
vim ~/my-workspace/templates/project.md
vim ~/my-workspace/templates/reveal-custom.css
```

#### Slides 自定义样式

在工作空间的 `templates/` 目录下创建 `reveal-custom.css` 文件，系统会自动应用该样式到生成的演示文稿。

示例：将项目内置的 CSS 模板复制到工作空间
```bash
cp /path/to/pWork-OS/templates/reveal-custom.css ~/my-workspace/templates/
```

自定义 CSS 可以控制：
- 标题位置和样式
- 内容布局和间距
- 图片大小和对齐
- 代码块样式
- 颜色和字体

---

## 🔧 高级配置

### 全局配置

全局配置存储在 `~/.pwork/config.json`：

```json
{
  "defaultWorkspace": "/path/to/my-workspace",
  "githubToken": "ghp_xxxxxxxxxxxx",
  "recentWorkspaces": [
    "/path/to/workspace1",
    "/path/to/workspace2"
  ],
  "preferences": {
    "editor": "code",
    "dateFormat": "YYYY-MM-DD",
    "weekStartsOn": 1
  }
}
```

配置项说明：
- `defaultWorkspace` - 默认工作空间路径
- `githubToken` - GitHub Personal Access Token
- `recentWorkspaces` - 最近使用的工作空间列表（最多 10 个）
- `preferences.editor` - 默认编辑器（可被 `$EDITOR` 环境变量覆盖）
- `preferences.dateFormat` - 日期格式
- `preferences.weekStartsOn` - 周起始日（0=周日，1=周一）

### 工作空间配置

每个工作空间的配置存储在 `.pwork.json`：

```json
{
  "version": "0.1.0",
  "name": "My Workspace",
  "created": "2026-01-18T00:00:00.000Z",
  "templates": {
    "daily": "templates/daily.md",
    "weekly": "templates/weekly.md",
    "project": "templates/project.md"
  }
}
```

### 命令选项

大多数命令支持 `--workspace` 或 `-w` 选项来指定工作空间：

```bash
# 使用指定工作空间
pwork daily new --workspace ~/other-workspace

# 或使用简写
pwork daily new -w ~/other-workspace
```

如果未指定，命令会按以下顺序查找工作空间：
1. 环境变量 `PWORK_WORKSPACE`
2. 从当前目录向上查找 `.pwork.json`
3. 使用全局配置中的 `defaultWorkspace`

---

## 📐 数据结构设计

### 核心约束

**一个项目（Project）= 一个 GitHub Repo**

这个约束确保：
- 项目边界清晰（代码/Issue/PR 不混淆）
- 自动化逻辑简单
- 支持无限项目扩展

### 仓库划分

采用**双层仓库模型**：

```
GitHub
├── my-workspace/              # 中枢仓库（Daily/Weekly/Projects 索引）
│   ├── daily/
│   ├── weekly/
│   ├── projects/
│   ├── templates/
│   └── slides/
│
├── project-a-repo/            # 项目 A 的代码仓库
├── project-b-repo/            # 项目 B 的代码仓库
└── project-c-repo/            # 项目 C 的代码仓库
```

### 文档类型检测

系统通过 YAML frontmatter 自动检测文档类型：

**Daily Log** - `type: daily` + `date` 字段：
```yaml
---
date: 2026-01-18
type: daily
week: 2026-W03
projects: [project-a]
tags: [experiment]
weekly_highlight: false
github:
  issues: []
  prs: []
---
```

**Weekly Report** - `type: weekly` + `week` 字段：
```yaml
---
week: 2026-W03
type: weekly
start_date: 2026-01-13
end_date: 2026-01-19
projects: [project-a, project-b]
---
```

**Project** - `project:` 对象 + `name` 和 `github_repo` 字段：
```yaml
---
project:
  name: PIFO Scheduler
  type: research
  github_repo: https://github.com/username/pifo-scheduler
  status: Doing
  start_date: 2026-01-01
  end_date: null
---
```

---

## 🛠️ 开发指南

### 构建命令

```bash
# 开发构建（带 watch）
npm run dev

# 生产构建
npm run build

# 运行测试
npm run test

# 运行测试（单次）
npm run test:run

# 类型检查
npm run typecheck

# 清理构建产物
npm run clean
```

### 项目结构

```
pWork-OS/
├── src/
│   ├── core/              # 核心模块
│   │   ├── schema.ts      # 类型定义
│   │   ├── parser.ts      # Frontmatter 解析
│   │   ├── fs.ts          # 文件系统操作
│   │   ├── config.ts      # 配置管理
│   │   └── aggregator.ts  # 数据聚合
│   │
│   ├── daily/             # Daily Log 模块
│   ├── weekly/            # Weekly Report 模块
│   ├── project/           # Project 模块
│   ├── github/            # GitHub 集成
│   ├── template/          # 模板引擎
│   ├── export/            # 导出功能
│   │   ├── renderer.ts    # Markdown → HTML
│   │   └── slides.ts      # Markdown → Slides
│   │
│   ├── viewer/            # Web 查看器
│   │   ├── server.ts      # HTTP 服务器
│   │   └── templates.ts   # HTML 模板
│   │
│   └── cli/               # CLI 入口
│       ├── index.ts       # 主入口
│       └── commands/      # 子命令
│           ├── init.ts
│           ├── config.ts
│           ├── daily.ts
│           ├── weekly.ts
│           ├── project.ts
│           ├── export.ts
│           └── view.ts
│
├── tests/                 # 测试文件
├── dist/                  # 构建输出
└── package.json
```

### 技术栈

- **语言**: TypeScript (ES2022, ESM)
- **运行时**: Node.js >= 20.0.0
- **构建工具**: tsup
- **测试框架**: vitest
- **CLI 框架**: Commander.js + Inquirer.js
- **Markdown 解析**: marked, gray-matter
- **日期处理**: date-fns
- **Slides 生成**: reveal-md (reveal.js)
- **GitHub API**: @octokit/rest

---

## 🤝 贡献指南

欢迎贡献代码、报告问题或提出建议！

### 开发流程

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 代码规范

- 使用 TypeScript 严格模式
- 遵循 ESLint 规则
- 编写单元测试
- 添加 JSDoc 注释

---

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源。

---

## 🙏 致谢

本项目受以下工具和理念启发：
- [Notion](https://notion.so) - 知识管理系统
- [Obsidian](https://obsidian.md) - Markdown 笔记工具
- [Logseq](https://logseq.com) - 大纲式笔记
- [reveal.js](https://revealjs.com) - HTML 演示文稿框架
- [reveal-md](https://github.com/webpro/reveal-md) - Markdown 到 reveal.js 的转换工具

---

## 📮 联系方式

- 问题反馈: [GitHub Issues](https://github.com/your-username/pWork-OS/issues)
- 功能建议: [GitHub Discussions](https://github.com/your-username/pWork-OS/discussions)

---

**pWork-OS** - 为开发者和研究者打造的个人工作操作系统 🚀
