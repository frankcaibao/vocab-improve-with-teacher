# English Vocabulary Practice Tool

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

## Technical Details

| Aspect | Implementation |
|--------|---------------|
| Backend | Python Flask；词库文件 `vocab-data.json`（共享）+ `users/` 每用户文件 |
| AI Gateway | OpenAI 兼容网关，后端 `call_ai()` 统一代理；Key 经 env / `ai_key.local` 注入，不入仓库 |
| Frontend Sync | BroadcastChannel API (same-origin, same browser) |
| Data Persistence | Server-side JSON（atomic writes via temp+rename），并发用 data_lock / users_lock |
| Pronunciation | 单词 + 句子浏览器 `speechSynthesis`（英音，句子仅读英文）；读音评测录 WAV → 多模态网关 |
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
