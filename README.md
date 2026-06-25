# 英语词汇练习工具 / English Vocabulary Practice Tool

**语言 / Language:** [中文](#中文) · [English](#english)

---

<a id="中文"></a>

# 中文

一款轻量、基于浏览器的英语词汇练习工具，专为一对一 / 小班辅导场景设计。教师端掌控学习节奏，学生展示端实时同步显示当前单词。

## 功能特性

### 学习模式
- 以乱序重复的方式循环练习尚未掌握的单词
- 可将单词标记为"已掌握"，或跳到下一个
- AI 辅助教学：释义、联想记忆、实战用法示例
- 实时统计，跟踪学习进度

### 词汇管理
- 单个添加或批量导入（每行一个）
- 内置预设词库：四级（CET-4）、六级（CET-6）、雅思（IELTS）
- 随时在"已掌握"与"待学习"之间切换单词状态
- 从列表中删除单词

### 词库系统
- 创建并管理多个命名词库
- 在词库之间即时切换
- 重命名或删除词库
- "另存为"以复制当前词库

### 数据同步与备份
- 将所有词库（含学习进度）导出为单个 JSON 文件
- 从 JSON 导入，在任意设备上恢复
- 把导出文件放入云盘（OneDrive、Google Drive 等）即可跨设备同步
- 导入时智能合并：已有词库会被合并，不丢失数据

### 师生同步
- 教师端与学生端通过 BroadcastChannel API 同步
- 在同一浏览器中打开两个页面即可——同步本身无需服务器
- 教师切换单词时，学生展示端即时更新
- AI 生成的内容也会同步到学生端

## 快速开始

### 1. 安装依赖

```bash
cd vocab-practice
pip install -r requirements.txt
```

### 2. 配置 AI 网关（地址 + Key）

AI 能力（释义、联想、追问对话、读音评测）通过一个 **OpenAI 兼容**的 chat-completions 端点调用。网关地址和 API Key 都不会存入仓库——`server.py` 中只提供一个占位符，你需要替换为**你自己的 AI 服务商地址**。两者均可通过环境变量或被 git 忽略的本地文件提供（按以下顺序读取）：

| 配置项 | 环境变量 | 本地文件（已 gitignore） | 示例 |
|------|---------|--------------------------|------|
| 网关地址 | `AI_API_BASE` | `ai_gateway.local` | `https://api.openai.com/v1/chat/completions` |
| API Key | `AI_API_KEY` | `ai_key.local` | `sk-...` |

```bash
# 方式 A —— 环境变量
export AI_API_BASE="https://api.openai.com/v1/chat/completions"
export AI_API_KEY="sk-your-key"
python server.py
```
```bash
# 方式 B —— 本地文件（各写一行），随后直接 python server.py
echo "https://api.openai.com/v1/chat/completions" > ai_gateway.local
echo "sk-your-key" > ai_key.local
```

模型名（`AI_MODEL`）及其它选项位于 `server.py` 顶部清晰标注的配置块中——把 `AI_MODEL` 改成你的服务商支持的模型。即使没有配置地址 / Key，应用仍可运行，但 AI 按钮会返回错误。

### 3. 启动服务器

```bash
python server.py
```

服务器启动在 `http://localhost:5000`，同时提供 API 和静态文件。

数据保存在项目目录下的 `vocab-data.json` 中。这个文件包含所有词库和学习进度——通过云盘同步它即可跨设备访问。

> **注意：** 旧的 `python -m http.server` 方式已不再适用。API 后端必须使用 Flask 服务器。

### 4. 在浏览器中打开

| 页面 | 网址 | 用途 |
|------|-----|------|
| 教师端 | `http://localhost:5000/teacher.html` | 控制面板（中文界面） |
| 学生端 | `http://localhost:5000/student.html` | 用于投影 / 屏幕共享的展示页 |

### 5. 开始上课

1. 进入 **"词汇管理"** 标签页添加单词（手动、批量或从预设词库）
2. 切换到 **"学习模式"** 开始本次学习
3. 使用 AI 按钮（释义 / 联想记忆 / 实战用法）生成教学内容
4. 点击 **"打开学生展示端"** 在新标签页打开学生视图

## 文件结构

```
vocab-practice/
├── server.py           # Flask 后端 API + 静态文件服务器
├── app.js              # 前端逻辑：API 客户端、播放器、SessionEngine、SyncChannel
├── teacher.html        # 教师控制界面（中文 UI）
├── student.html        # 学生展示页（极简，适合投影）
├── requirements.txt    # Python 依赖
├── LICENSE             # MIT
├── README.md
├── ai_gateway.local    # （git 忽略）你的 AI 服务商地址——本地创建
├── ai_key.local        # （git 忽略）你的 API Key——本地创建
├── vocab-data.json     # （git 忽略）共享词库，自动生成
└── users/              # （git 忽略）每个学生的进度 + 对话历史
```

## 数据格式

导出文件结构（JSON）：

```json
{
  "version": 1,
  "exportedAt": "2026-06-16T09:00:00Z",
  "currentLibrary": "My Library",
  "libraries": [
    {
      "name": "My Library",
      "words": [
        { "text": "abandon", "known": true, "addedAt": 1718520000000 },
        { "text": "abstract", "known": false, "addedAt": 1718520000000 }
      ]
    }
  ]
}
```

## AI 网关与 Key 配置

AI 能力（释义 / 联想 / 用法 / 例句、追问对话、读音评测）通过一个 **OpenAI 兼容**的 chat-completions 端点调用。**仓库公开，网关地址与 Key 都不写进代码**——`server.py` 里只放占位符，你需要自己填入 **你的 AI 服务商地址**。

### 1. 网关地址 + Key（二选一注入，不进仓库）

| 配置项 | 环境变量 | 本地文件(已 gitignore) | 示例 |
|--------|----------|------------------------|------|
| 网关地址 | `AI_API_BASE` | `ai_gateway.local` | `https://api.openai.com/v1/chat/completions` |
| API Key | `AI_API_KEY` | `ai_key.local` | `sk-...` |

```powershell
# 方式 A — 环境变量（Windows PowerShell，当前会话）
$env:AI_API_BASE = "https://api.openai.com/v1/chat/completions"
$env:AI_API_KEY  = "sk-你的key"
python server.py
```
```bash
# 方式 B — 本地文件（各写一行），随后直接 python server.py
echo "https://api.openai.com/v1/chat/completions" > ai_gateway.local
echo "sk-你的key" > ai_key.local
```

读取优先级：环境变量 → 本地文件 → 占位符（占位符不可用，会报错）。

### 2. 模型与其它选项 —— `server.py` 顶部配置块

```python
# ====== AI 网关配置 —— 只改这一块 ======
AI_GATEWAY_PLACEHOLDER = "https://YOUR-AI-PROVIDER.example.com/v1/chat/completions"  # 占位符，被 env/本地文件覆盖
AI_MODEL       = "vertex_ai/gemini-3.5-flash"   # 改成你的服务商支持的模型名
AI_TIMEOUT     = 60
AI_EXTRA_HEADERS = {}        # 部分网关需要额外 header，如 {"X-Model-Provider-Id": "..."}
AI_TTS_ENABLED = False       # 多数 chat 网关无音频输出；句子发音回退浏览器内置 TTS
```

- **换模型**：改 `AI_MODEL`。
- **换成 OpenAI / Claude 等**：把网关地址（`AI_API_BASE` / `ai_gateway.local`）指向对应的 `/v1/chat/completions`，`AI_MODEL` 改成对应模型名（如 `gpt-4o-mini`、`claude-sonnet-4-6`），其余代码无需改动（统一走 `call_ai()`）。

> 注意：本仓库 **公开**，请勿把真实网关地址或 Key 写回 `server.py` 后提交。

## 技术细节

| 方面 | 实现 |
|--------|---------------|
| 后端 | Python Flask；词库文件 `vocab-data.json`（共享）+ `users/` 每用户文件 |
| AI 网关 | OpenAI 兼容网关，后端 `call_ai()` 统一代理；Key 经 env / `ai_key.local` 注入，不入仓库 |
| 前端同步 | BroadcastChannel API（同源、同一浏览器） |
| 数据持久化 | 服务端 JSON（通过临时文件 + 重命名实现原子写入），并发用 data_lock / users_lock |
| 发音 | 单词 + 句子使用浏览器 `speechSynthesis`（英音，句子仅读英文）；读音评测录 WAV → 多模态网关 |
| 依赖 | Python：flask、flask-cors、requests；前端：零依赖 |
| 兼容性 | 现代浏览器 + Python 3.8+ |

## 使用技巧

- **云同步**：导出数据，把 JSON 文件保存到同步文件夹（OneDrive/Dropbox/iCloud），然后在另一台机器上导入
- **投影**：在投影屏上打开 `student.html`；可用深色模式开关适应不同光线环境
- **批量导入**：从 Excel/Word/文本文件粘贴单词——支持逗号、分号和换行分隔
- **复习已掌握的单词**：进入"词汇管理"标签页，在"已掌握"列中找到单词，点击"重新学习"把它们移回待学习

## 浏览器要求

- Chrome 54+ / Edge 79+ / Firefox 38+ / Safari 15.4+
- 启用 localStorage
- 启用 JavaScript

## 许可证

MIT

---

<a id="english"></a>

# English

A lightweight, browser-based English vocabulary practice tool designed for tutoring sessions. The teacher controls the learning flow while a synchronized student display mirrors the current word in real-time.

## Features

### Learning Mode
- Cycle through unknown words with shuffle-based repetition
- Mark words as mastered or skip to next
- AI-powered teaching aids: definitions, memory associations, and usage examples
- Progress tracking with real-time statistics

### Word Management
- Add words individually or batch import (one per line)
- Built-in preset word banks: CET-4, CET-6, IELTS
- Toggle words between "mastered" and "to learn" at any time
- Delete words from the list

### Library System
- Create and manage multiple named word banks
- Switch between libraries instantly
- Rename or delete libraries
- "Save As" to duplicate current library

### Data Sync & Backup
- Export all libraries (with learning progress) as a single JSON file
- Import from JSON to restore on any device
- Place the export file in a cloud drive (OneDrive, Google Drive, etc.) for cross-device sync
- Smart merge on import: existing libraries are merged without data loss

### Teacher-Student Sync
- Teacher and student views sync via BroadcastChannel API
- Open both pages in the same browser — no server required for sync
- Student display updates instantly when teacher navigates words
- AI-generated content is also synced to the student view

## Quick Start

### 1. Install dependencies

```bash
cd vocab-practice
pip install -r requirements.txt
```

### 2. Configure the AI gateway (address + key)

AI features (definitions, associations, follow-up chat, pronunciation assessment) call an **OpenAI-compatible** chat-completions endpoint. Neither the gateway address nor the API key is stored in the repo — `server.py` ships a placeholder you must replace with **your own AI provider's address**. Provide both via environment variables or git-ignored local files (checked in this order):

| What | Env var | Local file (git-ignored) | Example |
|------|---------|--------------------------|---------|
| Gateway address | `AI_API_BASE` | `ai_gateway.local` | `https://api.openai.com/v1/chat/completions` |
| API key | `AI_API_KEY` | `ai_key.local` | `sk-...` |

```bash
# option A — environment variables
export AI_API_BASE="https://api.openai.com/v1/chat/completions"
export AI_API_KEY="sk-your-key"
python server.py
```
```bash
# option B — local files (one line each), then just `python server.py`
echo "https://api.openai.com/v1/chat/completions" > ai_gateway.local
echo "sk-your-key" > ai_key.local
```

The model name (`AI_MODEL`) and other options live in the clearly-marked config block at the top of `server.py` — change `AI_MODEL` to a model your provider supports. Without a configured address/key the app still runs, but AI buttons return an error.

### 3. Start the server

```bash
python server.py
```

The server starts at `http://localhost:5000` and serves both the API and static files.

Data is stored in `vocab-data.json` in the project directory. This single file contains all word banks and learning progress — sync it via cloud drive for cross-device access.

> **Note:** The old `python -m http.server` approach no longer works. The Flask server is required for the API backend.

### 4. Open in browser

| Page | URL | Purpose |
|------|-----|---------|
| Teacher | `http://localhost:5000/teacher.html` | Control panel (Chinese UI) |
| Student | `http://localhost:5000/student.html` | Display for projection/screen sharing |

### 5. Start teaching

1. Go to the **"词汇管理"** tab to add words (manually, batch, or from presets)
2. Switch to **"学习模式"** to begin the session
3. Use the AI buttons (释义 / 联想记忆 / 实战用法) to generate teaching content
4. Click **"打开学生展示端"** to open the student view in a new tab

## File Structure

```
vocab-practice/
├── server.py           # Flask backend API + static file server
├── app.js              # Frontend logic: API client, players, SessionEngine, SyncChannel
├── teacher.html        # Teacher control interface (Chinese UI)
├── student.html        # Student display (minimalist, projection-friendly)
├── requirements.txt    # Python dependencies
├── LICENSE             # MIT
├── README.md
├── ai_gateway.local    # (git-ignored) your AI provider address — create locally
├── ai_key.local        # (git-ignored) your API key — create locally
├── vocab-data.json     # (git-ignored) shared word library, auto-generated
└── users/              # (git-ignored) per-student progress + chat history
```

## Data Format

Export file structure (JSON):

```json
{
  "version": 1,
  "exportedAt": "2026-06-16T09:00:00Z",
  "currentLibrary": "My Library",
  "libraries": [
    {
      "name": "My Library",
      "words": [
        { "text": "abandon", "known": true, "addedAt": 1718520000000 },
        { "text": "abstract", "known": false, "addedAt": 1718520000000 }
      ]
    }
  ]
}
```

## AI Gateway & Key Configuration

AI features (definitions / associations / usage / examples, follow-up chat, pronunciation assessment) call an **OpenAI-compatible** chat-completions endpoint. **This repo is public — neither the gateway address nor the key is written into the code.** `server.py` only ships a placeholder; you must fill in **your own AI provider's address**.

### 1. Gateway address + Key (inject either way, never committed)

| Setting | Env var | Local file (git-ignored) | Example |
|--------|----------|------------------------|------|
| Gateway address | `AI_API_BASE` | `ai_gateway.local` | `https://api.openai.com/v1/chat/completions` |
| API Key | `AI_API_KEY` | `ai_key.local` | `sk-...` |

```powershell
# Option A — environment variables (Windows PowerShell, current session)
$env:AI_API_BASE = "https://api.openai.com/v1/chat/completions"
$env:AI_API_KEY  = "sk-your-key"
python server.py
```
```bash
# Option B — local files (one line each), then just python server.py
echo "https://api.openai.com/v1/chat/completions" > ai_gateway.local
echo "sk-your-key" > ai_key.local
```

Read priority: env vars → local files → placeholder (the placeholder is non-functional and will error).

### 2. Model and other options — config block at the top of `server.py`

```python
# ====== AI gateway config — edit only this block ======
AI_GATEWAY_PLACEHOLDER = "https://YOUR-AI-PROVIDER.example.com/v1/chat/completions"  # placeholder, overridden by env/local file
AI_MODEL       = "vertex_ai/gemini-3.5-flash"   # change to a model your provider supports
AI_TIMEOUT     = 60
AI_EXTRA_HEADERS = {}        # some gateways need extra headers, e.g. {"X-Model-Provider-Id": "..."}
AI_TTS_ENABLED = False       # most chat gateways have no audio output; sentence pronunciation falls back to the browser's built-in TTS
```

- **Switch model**: change `AI_MODEL`.
- **Switch to OpenAI / Claude etc.**: point the gateway address (`AI_API_BASE` / `ai_gateway.local`) at the corresponding `/v1/chat/completions`, change `AI_MODEL` to the matching model name (e.g. `gpt-4o-mini`, `claude-sonnet-4-6`); no other code changes needed (everything goes through `call_ai()`).

> Note: This repo is **public** — do not write a real gateway address or key back into `server.py` and commit it.

## Technical Details

| Aspect | Implementation |
|--------|---------------|
| Backend | Python Flask; word library file `vocab-data.json` (shared) + per-user files in `users/` |
| AI Gateway | OpenAI-compatible gateway, proxied uniformly by backend `call_ai()`; key injected via env / `ai_key.local`, never committed |
| Frontend Sync | BroadcastChannel API (same-origin, same browser) |
| Data Persistence | Server-side JSON (atomic writes via temp + rename), concurrency via data_lock / users_lock |
| Pronunciation | Word + sentence use the browser's `speechSynthesis` (British accent, sentences read English only); pronunciation assessment records WAV → multimodal gateway |
| Dependencies | Python: flask, flask-cors, requests. Frontend: zero dependencies |
| Compatibility | Modern browsers + Python 3.8+ |

## Usage Tips

- **Cloud sync**: Export your data, save the JSON file to a synced folder (OneDrive/Dropbox/iCloud), and import it on another machine
- **Projection**: Open `student.html` on a projector screen; use dark mode toggle for different lighting conditions
- **Batch import**: Paste words from Excel/Word/text files — supports comma, semicolon, and newline separators
- **Review mastered words**: Go to "词汇管理" tab, find words in the "已掌握" column, click "重新学习" to move them back

## Browser Requirements

- Chrome 54+ / Edge 79+ / Firefox 38+ / Safari 15.4+
- localStorage enabled
- JavaScript enabled

## License

MIT
