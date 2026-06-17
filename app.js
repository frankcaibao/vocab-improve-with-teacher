// ============ Utilities ============
function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

async function api(path, options = {}) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    console.warn(`API error: ${path}`, err);
    return err;
  }
  return res.json();
}

// Upload a CSV/Excel file for word import. Uses multipart (FormData) — do NOT set
// Content-Type so the browser adds the multipart boundary. mode = 'auto' | 'ai'.
async function uploadWordsFile(file, mode) {
  const form = new FormData();
  form.append('file', file);
  form.append('mode', mode || 'auto');
  try {
    const res = await fetch('/api/import-words-file', { method: 'POST', body: form });
    return await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  } catch (e) {
    return { error: '上传失败，请检查服务是否运行' };
  }
}

// ============ Word Store (API-backed) ============
class WordStore {
  constructor() {
    this._cache = null;
  }

  async load() {
    const res = await api('/words');
    this._cache = res.words || [];
    this._stats = res.stats || { total: 0, known: 0, unknown: 0 };
    return this._cache;
  }

  getAll() { return this._cache || []; }
  getUnknown() { return (this._cache || []).filter(w => !w.known); }
  getKnown() { return (this._cache || []).filter(w => w.known); }
  getStats() { return this._stats || { total: 0, known: 0, unknown: 0 }; }

  async addWord(text) {
    const normalized = text.trim().toLowerCase();
    if (!normalized || normalized.length > 100) return false;
    if (this._cache && this._cache.some(w => w.text === normalized)) return false;
    const res = await api('/words', { method: 'POST', body: { texts: [normalized] } });
    if (res.added > 0) {
      await this.load();
      return true;
    }
    return false;
  }

  async addBatch(texts) {
    const normalized = texts.map(t => t.trim().toLowerCase()).filter(t => t && t.length <= 100);
    if (!normalized.length) return 0;
    const res = await api('/words', { method: 'POST', body: { texts: normalized } });
    await this.load();
    return res.added || 0;
  }

  async markKnown(text) {
    await api(`/words/${encodeURIComponent(text)}/known`, { method: 'PUT' });
    if (this._cache) {
      const w = this._cache.find(w => w.text === text);
      if (w) { w.known = true; this._stats.known++; this._stats.unknown--; }
    }
  }

  async markUnknown(text) {
    await api(`/words/${encodeURIComponent(text)}/unknown`, { method: 'PUT' });
    if (this._cache) {
      const w = this._cache.find(w => w.text === text);
      if (w) { w.known = false; this._stats.known--; this._stats.unknown++; }
    }
  }

  async deleteWord(text) {
    await api(`/words/${encodeURIComponent(text)}`, { method: 'DELETE' });
    await this.load();
  }
}

// ============ User Manager (API-backed) ============
class UserManager {
  constructor() {
    this._current = null;   // {id, name}
    this._list = [];        // [{id, name}]
  }

  async load() {
    const res = await api('/users');
    this._current = res.current || null;
    this._list = res.users || [];
    return this._list;
  }

  getCurrent() { return this._current; }
  getList() { return this._list; }

  async switchTo(id) {
    const res = await api('/users/current', { method: 'PUT', body: { id } });
    if (res.error) return false;
    await this.load();
    return true;
  }

  async create(name) {
    const res = await api('/users', { method: 'POST', body: { name } });
    if (res.error) return false;
    await this.load();
    return true;
  }

  async rename(id, name) {
    const res = await api(`/users/${encodeURIComponent(id)}/rename`, {
      method: 'PUT', body: { name }
    });
    if (res.error) return false;
    await this.load();
    return true;
  }

  async delete(id) {
    const res = await api(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.error) return false;
    await this.load();
    return true;
  }
}

// ============ Library Manager (API-backed) ============
class LibraryManager {
  constructor() {
    this._current = '默认词库';
    this._list = [];
  }

  async load() {
    const res = await api('/libraries');
    this._current = res.current;
    this._list = res.libraries || [];
    return this._list;
  }

  getCurrent() { return this._current; }
  getList() { return this._list; }
  getWordCount(name) {
    const lib = this._list.find(l => l.name === name);
    return lib ? lib.wordCount : 0;
  }

  async switchTo(name) {
    await api('/libraries/current', { method: 'PUT', body: { name } });
    this._current = name;
  }

  async create(name) {
    const res = await api('/libraries', { method: 'POST', body: { name } });
    if (res.error) return false;
    await this.load();
    return true;
  }

  async saveAs(newName) {
    const res = await api(`/libraries/${encodeURIComponent(this._current)}/saveas`, {
      method: 'POST', body: { name: newName }
    });
    if (res.error) return false;
    await this.load();
    return true;
  }

  async rename(oldName, newName) {
    const res = await api(`/libraries/${encodeURIComponent(oldName)}/rename`, {
      method: 'PUT', body: { name: newName }
    });
    if (res.error) return false;
    await this.load();
    return true;
  }

  async delete(name) {
    const res = await api(`/libraries/${encodeURIComponent(name)}`, { method: 'DELETE' });
    if (res.error) return false;
    if (res.current) this._current = res.current;
    await this.load();
    return true;
  }

  async exportAll() {
    const res = await api('/data');
    return JSON.stringify(res, null, 2);
  }

  async exportOne(name) {
    const res = await api('/data');
    const lib = res.libraries.find(l => l.name === name);
    if (!lib) return null;
    return JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      currentLibrary: name,
      libraries: [lib]
    }, null, 2);
  }

  async importAll(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      const res = await api('/import', { method: 'POST', body: data });
      if (res.ok) {
        await this.load();
        return { success: true, msg: `已导入 ${res.imported} 个词库` };
      }
      return { success: false, msg: res.error || '导入失败' };
    } catch (e) {
      return { success: false, msg: '文件解析失败' };
    }
  }
}

// ============ Session Engine ============
class SessionEngine {
  constructor(store) {
    this.store = store;
    this.queue = [];
    this.currentIndex = -1;
  }

  shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  start() {
    this.refillQueue();
    this.currentIndex = this.queue.length > 0 ? 0 : -1;
    return this.current();
  }

  refillQueue() {
    const unknowns = this.store.getUnknown();
    this.queue = this.shuffle(unknowns.map(w => w.text));
  }

  current() {
    if (this.currentIndex < 0 || this.queue.length === 0) return null;
    return this.queue[this.currentIndex];
  }

  next() {
    if (this.queue.length === 0) {
      this.refillQueue();
      this.currentIndex = this.queue.length > 0 ? 0 : -1;
      return this.current();
    }
    this.currentIndex++;
    if (this.currentIndex >= this.queue.length) {
      this.refillQueue();
      this.currentIndex = this.queue.length > 0 ? 0 : -1;
    }
    return this.current();
  }

  async markCurrentKnown() {
    const word = this.current();
    if (word) {
      await this.store.markKnown(word);
      this.queue.splice(this.currentIndex, 1);
      if (this.currentIndex >= this.queue.length) {
        if (this.queue.length === 0) {
          this.refillQueue();
          this.currentIndex = this.queue.length > 0 ? 0 : -1;
        } else {
          this.currentIndex = 0;
        }
      }
    }
    return this.current();
  }

  getProgress() {
    const stats = this.store.getStats();
    return {
      currentPos: this.currentIndex + 1,
      queueLength: this.queue.length,
      ...stats
    };
  }
}

// ============ AI Client (base content + chat via backend) ============
// All AI work goes through the backend; the API key never appears here.
const AIClient = {
  // GET /api/words/<text>/base/<module>  (module = explain|associate|usage)
  // Server caches the result; first generation can be slow. Falls back to
  // MockAI ONLY if the fetch errors, so the UI is never left blank.
  async getBase(word, module) {
    const res = await api(`/words/${encodeURIComponent(word)}/base/${encodeURIComponent(module)}`);
    if (res && typeof res.content === 'string') return res.content;
    // Silent fallback to local mock content on gateway/network error.
    switch (module) {
      case 'explain': return MockAI.generateExplanation(word);
      case 'associate': return MockAI.generateAssociation(word);
      case 'usage': return MockAI.generateUsage(word);
      default: return '（内容生成失败，请稍后重试）';
    }
  },

  // GET /api/chat?word=&module=  ->  [{role, content}, ...]
  async getChatHistory(word, module) {
    const res = await api(`/chat?word=${encodeURIComponent(word)}&module=${encodeURIComponent(module)}`);
    return (res && Array.isArray(res.history)) ? res.history : [];
  },

  // POST /api/chat {word, module, message}  ->  reply string
  async sendChat(word, module, message) {
    const res = await api('/chat', { method: 'POST', body: { word, module, message } });
    if (res && typeof res.reply === 'string') return res.reply;
    return res && res.error ? `（出错：${res.error}）` : '（未能获取回复）';
  },

  // POST /api/assess {word, audio(base64 w/o data-uri), mime:"audio/wav"}
  //   -> {score:int|null, feedback:str}
  async assessPronunciation(word, wavBase64) {
    const res = await api('/assess', {
      method: 'POST',
      body: { word, audio: wavBase64, mime: 'audio/wav' }
    });
    if (res && res.error && res.score === undefined) {
      return { score: null, feedback: res.error || '评测失败' };
    }
    return {
      score: (res && res.score !== undefined) ? res.score : null,
      feedback: (res && res.feedback) || ''
    };
  }
};

// ============ In-browser WAV Recorder ============
// MediaRecorder produces webm which the gateway rejects, so we capture raw PCM
// via Web Audio, downsample to 16 kHz mono, encode 16-bit PCM WAV, and return
// the WAV bytes as base64 (NO data-uri prefix). startRecording()/stopRecording().
const WavRecorder = {
  _stream: null,
  _ctx: null,
  _source: null,
  _processor: null,
  _chunks: [],
  _inputSampleRate: 44100,
  _recording: false,

  isRecording() { return this._recording; },

  async startRecording() {
    if (this._recording) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('当前浏览器不支持麦克风录音');
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      throw new Error('麦克风权限被拒绝或不可用');
    }
    this._stream = stream;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this._ctx = new AudioCtx();
    this._inputSampleRate = this._ctx.sampleRate;
    this._source = this._ctx.createMediaStreamSource(stream);
    // ScriptProcessorNode: deprecated but broadly supported; fine here.
    this._processor = this._ctx.createScriptProcessor(4096, 1, 1);
    this._chunks = [];
    this._processor.onaudioprocess = (e) => {
      if (!this._recording) return;
      const ch = e.inputBuffer.getChannelData(0);
      this._chunks.push(new Float32Array(ch));
    };
    this._source.connect(this._processor);
    this._processor.connect(this._ctx.destination);
    this._recording = true;
  },

  // Stop capture, tear down audio graph, return base64 WAV (no data-uri prefix).
  async stopRecording() {
    if (!this._recording) return null;
    this._recording = false;
    try { if (this._processor) this._processor.disconnect(); } catch (e) {}
    try { if (this._source) this._source.disconnect(); } catch (e) {}
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
    }
    if (this._ctx && this._ctx.state !== 'closed') {
      try { await this._ctx.close(); } catch (e) {}
    }

    // Flatten captured float PCM.
    let total = 0;
    for (const c of this._chunks) total += c.length;
    const merged = new Float32Array(total);
    let off = 0;
    for (const c of this._chunks) { merged.set(c, off); off += c.length; }
    this._chunks = [];

    if (total === 0) return null;

    const downsampled = this._downsample(merged, this._inputSampleRate, 16000);
    const wavBytes = this._encodeWav(downsampled, 16000);
    return this._bytesToBase64(wavBytes);
  },

  _downsample(buffer, inputRate, targetRate) {
    if (targetRate >= inputRate) return buffer;
    const ratio = inputRate / targetRate;
    const newLen = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLen);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < newLen) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
      let accum = 0, count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = count > 0 ? accum / count : 0;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  },

  // 16-bit PCM mono WAV (RIFF header + samples).
  _encodeWav(samples, sampleRate) {
    const bytesPerSample = 2;
    const blockAlign = bytesPerSample; // mono
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset, str) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);       // fmt chunk size
    view.setUint16(20, 1, true);        // PCM
    view.setUint16(22, 1, true);        // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);       // bits per sample
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, samples[i]));
      s = s < 0 ? s * 0x8000 : s * 0x7FFF;
      view.setInt16(offset, s, true);
    }
    return new Uint8Array(buffer);
  },

  _bytesToBase64(bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const sub = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, sub);
    }
    return btoa(binary);
  }
};

// ============ Pronunciation (double-end playback via SyncChannel) ============
// muted is per-page; toggled by the "本端静音" button. When muted, this end
// skips local playback both on direct trigger and on received broadcast.
let muted = false;
function setMuted(v) { muted = !!v; }
function isMuted() { return muted; }

// Pick an en-GB voice (fallback to any en-* voice). Re-queried each call since
// browsers may populate getVoices() asynchronously after page load.
function _pickEnVoice() {
  const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  if (!voices || !voices.length) return null;
  let v = voices.find(x => (x.lang || '').toLowerCase().startsWith('en-gb'));
  if (!v) v = voices.find(x => (x.lang || '').toLowerCase().startsWith('en'));
  return v || null;
}

// Keep only English for TTS: drop Chinese/any non-ASCII, drop markdown/symbols
// like # * _ ` ~ > | etc., so the voice reads only the English sentence.
function extractEnglishForTTS(text) {
  return (text || '')
    .replace(/[^\x00-\x7F]/g, ' ')                          // remove all non-ASCII (Chinese, full-width…)
    .replace(/[#*_`~>|=+\\/\[\]{}<]/g, ' ')    // remove markdown/symbols incl. '#' and control chars
    .replace(/\s+/g, ' ')
    .trim();
}

// ---- playback rate (persisted) ----
function loadTtsRate() {
  const r = parseFloat(localStorage.getItem('vocab_tts_rate'));
  return (r >= 0.5 && r <= 2) ? r : 1.0;
}
function saveTtsRate(r) { try { localStorage.setItem('vocab_tts_rate', String(r)); } catch (e) {} }

// Single short utterance (used for word pronunciation; no progress bar needed).
function _speak(text, rate) {
  if (!window.speechSynthesis || !text) return;
  // A word interrupts any sentence playback — clear the player state/UI first.
  if (TTSPlayer.playing || TTSPlayer.paused) TTSPlayer.stop();
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-GB';
    const voice = _pickEnVoice();
    if (voice) u.voice = voice;
    u.rate = (rate >= 0.5 && rate <= 2) ? rate : (TTSPlayer.rate || 1.0);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch (e) {
    console.warn('speak failed', e);
  }
}

// Sentence player around speechSynthesis: approximate progress via onboundary
// (charIndex), seek by restarting from the nearest word, native pause/resume,
// adjustable rate. speechSynthesis has no audio timeline, so seek = restart.
const TTSPlayer = {
  rate: loadTtsRate(),
  text: '',
  startChar: 0,
  lastPos: 0,
  playing: false,
  paused: false,
  sync: null,
  _ui: null,

  attach(sync) { this.sync = sync; },
  bindUI(cb) { this._ui = cb; this._emitState(); },
  _emitProgress(f) { if (this._ui && this._ui.onProgress) this._ui.onProgress(Math.max(0, Math.min(1, f || 0))); },
  _emitState() { if (this._ui && this._ui.onState) this._ui.onState({ playing: this.playing, paused: this.paused, rate: this.rate, hasText: !!this.text }); },

  // User-initiated play (broadcasts so the other end plays too).
  play(text) {
    const en = extractEnglishForTTS(text);
    if (!en) return;
    this.text = en; this.startChar = 0; this.lastPos = 0;
    this._start(true);
  },
  // Remote-initiated (from broadcast): play without re-broadcasting.
  applyRemote(text, opts) {
    const en = extractEnglishForTTS(text);
    if (!en) return;
    this.text = en;
    if (opts && opts.rate >= 0.5 && opts.rate <= 2) this.rate = opts.rate;
    this.startChar = Math.max(0, Math.min((opts && opts.startChar) || 0, en.length));
    this.lastPos = this.startChar;
    this._start(false);
  },
  seek(fraction) {
    if (!this.text) return;
    let c = Math.floor(fraction * this.text.length);
    while (c > 0 && !/\s/.test(this.text[c - 1])) c--;   // back to word start
    this.startChar = Math.max(0, Math.min(c, this.text.length));
    this.lastPos = this.startChar;
    this._start(true);
  },
  setRate(r) {
    if (!(r >= 0.5 && r <= 2)) return;
    this.rate = r; saveTtsRate(r);
    if (this.playing && this.text) { this.startChar = this.lastPos; this._start(true); }
    else this._emitState();
  },
  togglePlay() {
    if (this.paused) { this.resume(); }
    else if (this.playing) { this.pause(); }
    else if (this.text) { this.startChar = this.lastPos; this._start(true); }
  },
  pause() {
    if (window.speechSynthesis && this.playing && !this.paused) {
      window.speechSynthesis.pause(); this.paused = true; this._emitState();
    }
  },
  resume() {
    if (window.speechSynthesis && this.paused) {
      window.speechSynthesis.resume(); this.paused = false; this._emitState();
    }
  },
  stop() {
    this._token = (this._token || 0) + 1;   // invalidate any pending callbacks
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    this.playing = false; this.paused = false; this._emitState();
  },
  _start(broadcast) {
    // Broadcast even when locally muted, so the non-muted end still plays.
    if (broadcast && this.sync) {
      this.sync.send({ type: 'pronounce', text: this.text, kind: 'sentence', rate: this.rate, startChar: this.startChar });
    }
    if (!window.speechSynthesis || isMuted() || !this.text) { this.playing = false; this.paused = false; this._emitState(); return; }
    try {
      // Per-invocation token: a cancelled utterance's late onend/onboundary must
      // not mutate state for the new utterance (cancel() fires onend async).
      const token = (this._token = (this._token || 0) + 1);
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(this.text.slice(this.startChar));
      u.lang = 'en-GB';
      const voice = _pickEnVoice();
      if (voice) u.voice = voice;
      u.rate = this.rate;
      u.onboundary = (e) => {
        if (this._token !== token) return;
        this.lastPos = this.startChar + (e.charIndex || 0);
        this._emitProgress(this.text.length ? this.lastPos / this.text.length : 0);
      };
      u.onend = () => {
        if (this._token !== token || !this.playing) return;
        this.playing = false; this.paused = false;
        this.lastPos = 0; this.startChar = 0;
        this._emitProgress(1); this._emitState();
      };
      this.playing = true; this.paused = false;
      this._emitProgress(this.text.length ? this.startChar / this.text.length : 0);
      this._emitState();
      window.speechSynthesis.speak(u);
    } catch (e) {
      console.warn('TTSPlayer start failed', e);
      this.playing = false; this._emitState();
    }
  },
};

// Public entry: play locally AND broadcast so BOTH ends play once. Either end
// can trigger. SyncChannel suppresses same-role echo.
function pronounce(text, kind, sync) {
  if (!text) return;
  if (kind === 'sentence') {
    if (sync) TTSPlayer.attach(sync);
    TTSPlayer.play(text);              // play() broadcasts internally
  } else {
    if (sync) sync.send({ type: 'pronounce', text, kind: 'word', rate: TTSPlayer.rate });
    if (!isMuted()) _speak(text, TTSPlayer.rate);
  }
}

// ============ Sync Channel ============
class SyncChannel {
  constructor(role) {
    this.channel = new BroadcastChannel('vocab-practice-sync');
    this.role = role;
    this.channel.onmessageerror = (e) => console.warn('Sync message error', e);
    window.addEventListener('beforeunload', () => this.channel.close());
  }

  send(data) {
    this.channel.postMessage({ from: this.role, ...data });
  }

  onMessage(callback) {
    this.channel.addEventListener('message', (e) => {
      if (e.data.from !== this.role) {
        // Built-in handling for pronounce so every page that wires onMessage
        // plays received broadcasts (respecting local mute) automatically.
        if (e.data.type === 'pronounce') {
          if (e.data.kind === 'sentence') {
            TTSPlayer.attach(this);
            TTSPlayer.applyRemote(e.data.text, { rate: e.data.rate, startChar: e.data.startChar || 0 });
          } else if (!isMuted()) {
            _speak(e.data.text, e.data.rate || TTSPlayer.rate);
          }
        }
        callback(e.data);
      }
    });
  }

  sendWordUpdate(word, aiContent) {
    this.send({ type: 'word-update', word, aiContent: aiContent || null });
  }

  sendAiContent(aiContent) {
    this.send({ type: 'ai-content', aiContent });
  }
}

// ============ Mock AI ============
const MockAI = {
  definitions: {
    abandon: { cn: '放弃；抛弃', en: 'to give up completely; to leave behind' },
    abstract: { cn: '抽象的；摘要', en: 'existing in thought or as an idea but not having physical existence' },
    academic: { cn: '学术的；学院的', en: 'relating to education and scholarship' },
    access: { cn: '进入；通道；访问', en: 'the means or opportunity to approach or enter a place' },
    accommodate: { cn: '容纳；适应；提供住宿', en: 'to provide lodging or sufficient space for' },
    abolish: { cn: '废除；废止', en: 'to formally put an end to a system or practice' },
    absurd: { cn: '荒谬的；可笑的', en: 'wildly unreasonable or illogical' },
    accelerate: { cn: '加速；促进', en: 'to increase in speed or rate' },
    acknowledge: { cn: '承认；确认；致谢', en: 'to accept or admit the existence or truth of' },
    acquisition: { cn: '获得；收购', en: 'the act of gaining possession of something' },
    adequate: { cn: '充足的；适当的', en: 'sufficient for a specific need or requirement' },
    adjacent: { cn: '邻近的；毗连的', en: 'next to or near something else' },
    advocate: { cn: '提倡；拥护者', en: 'to publicly recommend or support' },
    aesthetic: { cn: '美学的；审美的', en: 'concerned with beauty or the appreciation of beauty' },
    alleviate: { cn: '减轻；缓和', en: 'to make suffering or a problem less severe' },
    ambitious: { cn: '有雄心的；野心勃勃的', en: 'having a strong desire for success or achievement' },
    anticipate: { cn: '预期；期望', en: 'to regard as probable; to expect or predict' },
    apparatus: { cn: '器械；装置；机构', en: 'the technical equipment needed for a particular activity' },
    arbitrary: { cn: '任意的；武断的', en: 'based on random choice rather than reason' },
    authentic: { cn: '真实的；可信的', en: 'of undisputed origin; genuine' },
  },

  associations: {
    abandon: '联想: a + ban + don → 一个(a)被禁止(ban)的人选择放弃(don=done)\n词根: 来自古法语 "à bandon" = 在某人的控制下',
    abstract: '联想: abs(离开) + tract(拉) → 从具体中抽离出来\n词根: abs- = away, tract = pull/draw',
    academic: '联想: academy(学院) + ic → 学院的\n词根: 源自柏拉图的学园 Akademia',
    access: '联想: ac(朝向) + cess(走) → 走向某处 → 进入\n词根: cess/cede = to go',
    accommodate: '联想: ac + com(一起) + mod(模式) + ate → 调整模式让大家在一起\n词根: modus = measure, manner',
    abolish: '联想: a + bol(球) + ish → 把旧规则像球一样踢走\n词根: abolere(拉丁语) = to destroy',
    absurd: '联想: ab(偏离) + surd(聋的/无理的) → 偏离理性 → 荒谬\n近义词: ridiculous, ludicrous, preposterous',
    accelerate: '联想: ac + celer(快速) + ate → 变快\n词根: celer = swift (同源词: celerity)',
    acknowledge: '联想: ac + knowledge → 承认知道 → 承认\n用法: acknowledge receipt of = 确认收到',
    acquisition: '联想: ac(朝向) + quis(寻求) + ition → 去寻求获得\n词根: quaerere = to seek',
    adequate: '联想: ad(朝向) + equ(相等) + ate → 达到相等水平 → 足够\n反义词: inadequate',
    adjacent: '联想: ad(靠近) + jac(躺) + ent → 躺在旁边 → 邻近\n词根: jacere = to lie',
    advocate: '联想: ad(朝向) + voc(声音) + ate → 为之发声 → 提倡\n词根: vocare = to call',
    aesthetic: '联想: 源自希腊语 aisthētikos = 感知的\n搭配: aesthetic value, aesthetic experience',
    alleviate: '联想: al + lev(轻) + iate → 使变轻 → 减轻\n词根: levis = light (同源: elevator, levitate)',
  },

  usages: {
    abandon: '1. She had to abandon her plan due to lack of funding.\n2. The crew abandoned the sinking ship.\n3. He danced with wild abandon at the party.\n搭配: abandon hope / abandon ship / with abandon',
    abstract: '1. The concept of justice is quite abstract.\n2. Please write a 200-word abstract for your paper.\n3. Abstract art doesn\'t represent real objects.\n搭配: abstract concept / abstract thinking / in the abstract',
    academic: '1. Her academic performance has improved significantly.\n2. The debate is purely academic — it won\'t change anything.\n搭配: academic year / academic research / academic achievement',
    access: '1. Students have free access to the library.\n2. You can access the files through the cloud.\n搭配: gain access / access to information / access code',
    accommodate: '1. The hotel can accommodate up to 500 guests.\n2. We\'ll try to accommodate your special requirements.\n搭配: accommodate needs / accommodate changes',
    abolish: '1. Many countries have abolished the death penalty.\n2. Lincoln worked to abolish slavery.\n搭配: abolish a law / abolish slavery / abolish the system',
    absurd: '1. It\'s absurd to suggest that the earth is flat.\n2. The theater of the absurd explores meaninglessness.\n搭配: patently absurd / absurd idea / reduce to absurdity',
    accelerate: '1. The car accelerated from 0 to 60 in 5 seconds.\n2. We need to accelerate the pace of reform.\n搭配: accelerate growth / accelerate the process',
    acknowledge: '1. She acknowledged that she had made a mistake.\n2. He is widely acknowledged as the leading expert.\n搭配: acknowledge a mistake / widely acknowledged',
    acquisition: '1. The acquisition of new skills takes time.\n2. The company\'s latest acquisition cost $2 billion.\n搭配: language acquisition / data acquisition / acquisition of knowledge',
    adequate: '1. Make sure you get adequate sleep before the exam.\n2. The food supply is barely adequate.\n搭配: adequate resources / adequate preparation / adequate supply',
    adjacent: '1. The park is adjacent to the school.\n2. They booked adjacent rooms at the hotel.\n搭配: adjacent to / adjacent areas / adjacent buildings',
    advocate: '1. She advocates for children\'s rights.\n2. He is a strong advocate of free trade.\n搭配: advocate for / advocate a policy / consumer advocate',
    aesthetic: '1. The building has great aesthetic appeal.\n2. She has a refined aesthetic sense.\n搭配: aesthetic value / aesthetic pleasure / aesthetic judgment',
    alleviate: '1. This medicine will alleviate your pain.\n2. The government is trying to alleviate poverty.\n搭配: alleviate pain / alleviate suffering / alleviate poverty',
  },

  generateExplanation(word) {
    const def = this.definitions[word];
    if (def) return `📖 释义\n\n中文：${def.cn}\nEnglish: ${def.en}`;
    return `📖 释义\n\n中文：（该词释义待补充）\nEnglish: This word refers to a concept or action that needs further context to define precisely.\n\n💡 建议查阅词典获取准确释义`;
  },

  generateAssociation(word) {
    const assoc = this.associations[word];
    if (assoc) return `🧠 联想记忆\n\n${assoc}`;
    const firstHalf = word.slice(0, Math.ceil(word.length / 2));
    const secondHalf = word.slice(Math.ceil(word.length / 2));
    return `🧠 联想记忆\n\n拆分: ${firstHalf} + ${secondHalf}\n字母数: ${word.length}\n首字母: ${word[0].toUpperCase()} — 尝试用首字母联想一个画面\n\n💡 创造属于你自己的记忆故事`;
  },

  generateUsage(word) {
    const usage = this.usages[word];
    if (usage) return `✍️ 实战用法\n\n${usage}`;
    return `✍️ 实战用法\n\n1. The concept of "${word}" is important in this context.\n2. Can you explain what "${word}" means in this sentence?\n\n💡 尝试用这个词造一个自己的句子`;
  }
};

// ============ Presets ============
const PRESETS = {
  'CET-4 核心': ['abandon', 'abstract', 'academic', 'access', 'accommodate', 'ambitious', 'anticipate', 'apparatus', 'arbitrary', 'authentic', 'benefit', 'budget', 'candidate', 'capacity', 'comprehensive', 'conflict', 'consequence', 'demonstrate', 'distinguish', 'elaborate'],
  'CET-6 核心': ['abolish', 'absurd', 'accelerate', 'acknowledge', 'acquisition', 'aggregate', 'alliance', 'ambiguous', 'analogy', 'anonymous', 'articulate', 'ascend', 'aspire', 'autonomy', 'benchmark', 'calibrate', 'coerce', 'collaborate', 'compatible', 'contemplate'],
  '雅思高频': ['adequate', 'adjacent', 'advocate', 'aesthetic', 'alleviate', 'allocate', 'amend', 'approximate', 'articulate', 'attribute', 'benchmark', 'bias', 'chronic', 'coherent', 'compensate', 'comply', 'conceive', 'consensus', 'constraint', 'context']
};
