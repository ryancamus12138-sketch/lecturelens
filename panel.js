import * as pdfjsLib from './lib/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.mjs');
const { parseAny, mergeCues } = globalThis.LLParse;

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const fmt = (t) => { t = Math.max(0, Math.floor(t)); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); };
const ukey = (u) => Math.round(u.s * 10) + '|' + u.t.length;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Interface language. DOM text is handled by i18n.js; L() is for strings that go into files or chat bubbles.
const L = (zh, en) => (globalThis.LLi18n.lang === 'en' ? en : zh);
function setLang(l) {
  globalThis.LLi18n.set(l);
  $('langBtn').textContent = globalThis.LLi18n.lang === 'en' ? '中文' : 'English';
}

// ---------------------------------------------------------------- settings
const DEF = {
  provider: 'anthropic', baseUrl: 'https://api.openai.com/v1', apiKey: '',
  modelFast: 'claude-haiku-5-5', modelSmart: 'claude-sonnet-5-5',
  smartSep: false, smartProvider: 'openai', smartBaseUrl: 'https://api.openai.com/v1', smartKey: '',
  codexModel: 'default', codexEffort: 'low', scanShots: '2',
  lang: '简体中文', segMin: 5, overlay: 'both', autoTranslate: true, autoSummary: true, vision: true,
};
let cfg = { ...DEF };
const CFG_IDS = ['provider', 'baseUrl', 'apiKey', 'modelFast', 'modelSmart', 'smartSep', 'smartProvider', 'smartBaseUrl', 'smartKey', 'codexModel', 'codexEffort', 'scanShots', 'lang', 'segMin', 'overlay', 'autoTranslate', 'autoSummary', 'vision'];

// ----- local Codex (ChatGPT plan) as the summary model
const CODEX_URL = 'http://127.0.0.1:8765/v1';
const EFFORT_NAMES = { default: '跟随 Codex 配置', minimal: 'minimal（最快）', low: 'low（快）', medium: 'medium（均衡）', high: 'high（细致）', xhigh: 'xhigh（最细致，最慢）', max: 'max' };
let codexCat = { data: [], default_model: null, default_effort: null };
const isCodex = () => cfg.smartSep && cfg.smartProvider === 'codex';
function fillCodex() {
  const ms = $('codexModel'), es = $('codexEffort');
  ms.textContent = ''; es.textContent = '';
  const add = (sel, v, label) => { const o = el('option', '', label); o.value = v; sel.append(o); };
  add(ms, 'default', '跟随 Codex 配置' + (codexCat.default_model ? `（当前 ${codexCat.default_model}）` : ''));
  codexCat.data.forEach((m) => add(ms, m.id, m.name && m.name !== m.id ? `${m.name}（${m.id}）` : m.id));
  if (cfg.codexModel !== 'default' && !codexCat.data.some((m) => m.id === cfg.codexModel)) add(ms, cfg.codexModel, cfg.codexModel);
  const cur = codexCat.data.find((m) => m.id === (cfg.codexModel === 'default' ? codexCat.default_model : cfg.codexModel));
  let effs = cur && cur.efforts && cur.efforts.length ? cur.efforts : ['low', 'medium', 'high', 'xhigh'];
  if (!effs.includes(cfg.codexEffort) && cfg.codexEffort !== 'default') effs = effs.concat(cfg.codexEffort);
  add(es, 'default', EFFORT_NAMES.default + (cur && cur.default_effort ? `（该模型默认 ${cur.default_effort}）` : codexCat.default_effort ? `（当前 ${codexCat.default_effort}）` : ''));
  effs.forEach((e) => add(es, e, EFFORT_NAMES[e] || e));
}
async function codexRefresh() {
  if (!isCodex()) return;
  const info = $('codexInfo');
  if (!cfg.smartKey) { info.textContent = '先填口令（启动 bridge.py 时终端里显示的 ll-… 那串）'; return; }
  info.textContent = '读取中…';
  try {
    const r = await fetch((cfg.smartBaseUrl || CODEX_URL).replace(/\/+$/, '') + '/models', { headers: { authorization: 'Bearer ' + cfg.smartKey } });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || r.status);
    codexCat = { data: j.data || [], default_model: j.default_model, default_effort: j.default_effort };
    chrome.storage.local.set({ codexCat });
    info.textContent = codexCat.data.length ? `读到 ${codexCat.data.length} 个可用模型` : '已连上，但没读到模型列表：可以先用“跟随 Codex 配置”';
  } catch (e) {
    info.textContent = /Failed to fetch/i.test(e.message) ? '连不上本机桥接：请先在终端运行 python3 codex-bridge/bridge.py' : '读取失败：' + e.message;
  }
  cfgToUi();
}

function cfgToUi() {
  fillCodex();
  $('codexBox').hidden = cfg.smartProvider !== 'codex';
  $('smartKeyLabel').textContent = cfg.smartProvider === 'codex' ? '桥接口令（终端里显示的 ll-… 那串）' : '总结接口的 API key';
  for (const k of CFG_IDS) { const e = $(k); if (e.type === 'checkbox') e.checked = !!cfg[k]; else e.value = cfg[k]; }
  $('baseRow').hidden = cfg.provider !== 'openai';
  $('smartBox').hidden = !cfg.smartSep;
  $('smartBaseRow').hidden = cfg.smartProvider === 'anthropic';
  $('smartBaseUrl').placeholder = cfg.smartProvider === 'codex' ? CODEX_URL : 'https://api.openai.com/v1';
  banner();
}
function banner() {
  const b = $('banner');
  b.hidden = !!cfg.apiKey;
  b.textContent = '还没有填 API key：字幕原文可以同步显示，但翻译、总结和提问需要先在“设置”里配置模型接口。';
}
function bindCfg() {
  for (const k of CFG_IDS) {
    $(k).addEventListener('change', () => {
      const e = $(k);
      const old = cfg[k];
      cfg[k] = e.type === 'checkbox' ? e.checked : (e.type === 'number' ? Math.max(2, Math.min(20, +e.value || 5)) : e.value.trim());
      if (k === 'provider' && old !== cfg.provider) {
        if (cfg.provider === 'anthropic') { cfg.modelFast = DEF.modelFast; cfg.modelSmart = DEF.modelSmart; }
        else { cfg.modelFast = ''; cfg.modelSmart = ''; }
      }
      if (k === 'smartProvider' && old !== cfg.smartProvider) {
        if (cfg.smartProvider === 'codex') cfg.smartBaseUrl = CODEX_URL;
        else if (cfg.smartBaseUrl === CODEX_URL) cfg.smartBaseUrl = DEF.smartBaseUrl;
        if (old === 'codex' || cfg.smartProvider === 'codex') cfg.smartKey = '';
      }
      chrome.storage.local.set({ cfg });
      cfgToUi();
      if (['smartProvider', 'smartKey', 'smartBaseUrl', 'smartSep'].includes(k)) codexRefresh();
      if (k === 'segMin' && old !== cfg.segMin) { S.sum = {}; S.sumSeg = cfg.segMin; S.overall = ''; buildSegs(); renderSums(); save(); }
      if (k === 'overlay') pushOverlay(true);
      trFails = {}; pump();
    });
  }
}

// ---------------------------------------------------------------- LLM
async function llm({ system, parts, history = [], smart = false, maxTokens = 2500 }) {
  if (!cfg.apiKey) throw new Error('未配置 API key');
  const sep = smart && cfg.smartSep; // summaries / Q&A may go to a different provider than translation
  if (sep && !cfg.smartKey) throw new Error('已勾选“总结改用另一家接口”，但还没填它的 API key');
  const codex = sep && cfg.smartProvider === 'codex';
  if (sep && !codex && !cfg.modelSmart) throw new Error('请填写“总结 / 答疑用模型”的名称');
  const P = sep ? { provider: codex ? 'openai' : cfg.smartProvider, baseUrl: cfg.smartBaseUrl || (codex ? CODEX_URL : ''), key: cfg.smartKey } : { provider: cfg.provider, baseUrl: cfg.baseUrl, key: cfg.apiKey };
  const model = codex ? cfg.codexModel : sep ? cfg.modelSmart : ((smart && cfg.modelSmart) || cfg.modelFast || cfg.modelSmart);
  const wf = (s) => { s = String(s == null ? '' : s); return (s.toWellFormed ? s.toWellFormed() : s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD')).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' '); };
  system = wf(system);
  parts = parts.map((p) => (p.image ? p : { text: wf(p.text) }));
  history = history.map((h) => ({ role: h.role, content: wf(h.content) }));
  if (!model) throw new Error('未填写模型名称');
  let url, headers, body;
  if (P.provider === 'anthropic') {
    const content = parts.map((p) => p.image
      ? { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: p.image.split(',')[1] } }
      : { type: 'text', text: p.text });
    url = 'https://api.anthropic.com/v1/messages';
    headers = { 'content-type': 'application/json', 'x-api-key': P.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
    body = { model, max_tokens: maxTokens, system, messages: [...history, { role: 'user', content }] };
  } else {
    const hasImg = parts.some((p) => p.image);
    const content = hasImg
      ? parts.map((p) => p.image ? { type: 'image_url', image_url: { url: p.image } } : { type: 'text', text: p.text })
      : parts.map((p) => p.text).join('\n\n');
    url = (P.baseUrl || DEF.baseUrl).replace(/\/+$/, '') + '/chat/completions';
    headers = { 'content-type': 'application/json', authorization: 'Bearer ' + P.key };
    body = { model, messages: [{ role: 'system', content: system }, ...history, { role: 'user', content }] };
    if (codex) body.reasoning_effort = cfg.codexEffort;
  }
  let lastErr, triedResponses = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (triedResponses && attempt > 1) break;
    let r;
    try { r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) }); }
    catch (e) {
      if (codex) throw new Error('连不上本机 Codex 桥接：请确认终端里的 python3 codex-bridge/bridge.py 还在运行');
      lastErr = new Error('网络错误：' + e.message); await sleep(1500 * (attempt + 1)); continue;
    }
    if (r.ok) {
      const j = await r.json();
      const text = P.provider === 'anthropic'
        ? (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('')
        : (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content)
          || j.output_text || (j.output || []).flatMap((o) => o.content || []).filter((c) => c.type === 'output_text').map((c) => c.text).join('') || '';
      if (!text) throw new Error('模型返回为空');
      return text;
    }
    const t = (await r.text()).slice(0, 300);
    lastErr = new Error(`接口返回 ${r.status}：${t}`);
    // models that are only served by OpenAI's newer Responses API: retry there once
    if (P.provider !== 'anthropic' && !/\/responses$/.test(url) && (r.status === 404 || (r.status === 400 && /responses|chat\/completions|not supported/i.test(t)))) {
      url = url.replace(/\/chat\/completions$/, '/responses');
      const conv = (m, role) => ({ role, content: typeof m === 'string' ? [{ type: role === 'assistant' ? 'output_text' : 'input_text', text: m }] : m.map((p) => p.type === 'image_url' ? { type: 'input_image', image_url: p.image_url.url } : { type: 'input_text', text: p.text }) });
      const msgs = body.messages;
      body = { model, instructions: system, input: msgs.slice(1).map((m) => conv(m.content, m.role)) };
      attempt--; triedResponses = true;
      continue;
    }
    if (r.status === 429 || r.status >= 500) { await sleep(2500 * (attempt + 1)); continue; }
    break;
  }
  throw lastErr;
}

// ---------------------------------------------------------------- session state
const S = {
  sid: 0, tabId: null, vTab: null, frameId: null, frames: new Map(),
  key: null, title: '', course: '', url: '', source: '', noCap: false, t0: 0, rawLen: 0, units: [], tr: {}, segs: [], sum: {}, sumSeg: 5, overall: '',
  deck: null, chat: [], t: 0, dur: 0, rate: 1, paused: true, lastTick: 0, act: -1,
  fbs: {}, lastFrame: null, tainted: false,
};
let pendingDeck = null;
let saveTimer = null;

// Course library: 'S:<key>' holds the full session (with screenshots), 'T:<key>' a text-only copy
// (transcript + translation + notes) used for whole-course search, 'IDX' the list of lectures.
let IDX = {};
const courseOf = (title, key) => {
  const m = String(title || '').match(/\b[A-Z]{2,5} ?\d{3,4}[A-Z]?\b/); // COMP9517, CS 101, MATH201A …
  if (m) return m[0].replace(' ', '');
  try { return new URL(key).hostname; } catch (e) { return 'Other'; }
};
function persist() {
  if (!S.key) return Promise.resolve();
  const now = Date.now();
  const o = { ['S:' + S.key]: { title: S.title, tr: S.tr, sum: S.sum, sumSeg: S.sumSeg, overall: S.overall, deck: S.deck, chat: S.chat.slice(-30), savedAt: now } };
  const sums = S.segs.filter((s) => S.sum[s.i] && S.sum[s.i].md).map((s) => ({ s: s.s, e: s.e, md: S.sum[s.i].md }));
  if (S.units.length || sums.length) {
    const r1 = (x) => Math.round(x * 10) / 10;
    o['T:' + S.key] = { title: S.title, course: S.course, dur: S.dur, units: S.units.map((u) => ({ s: r1(u.s), e: r1(u.e), t: u.t, z: S.tr[ukey(u)] || '' })), sums, overall: S.overall, savedAt: now };
    IDX[S.key] = { title: S.title, course: S.course, n: S.units.length, ns: sums.length, savedAt: now };
    o.IDX = IDX;
  }
  return chrome.storage.local.set(o).catch(() => {});
}
function save() {
  if (!S.key) return;
  clearTimeout(saveTimer);
  const key = S.key;
  saveTimer = setTimeout(() => { if (S.key === key) persist(); }, 1200);
}

async function switchSession(key, title) {
  if (S.key) { clearTimeout(saveTimer); await persist(); }
  if (scanning) { scanning = false; scanBtn(); }
  S.sid++;
  Object.assign(S, { key, title: title || '', course: courseOf(title, key), source: '', rawLen: 0, units: [], tr: {}, segs: [], sum: {}, sumSeg: cfg.segMin, overall: '', deck: null, chat: [], act: -1, fbs: {}, lastFrame: null, tainted: false, noCap: false, t0: Date.now() });
  trFails = {}; trBusy.clear(); sumQueue.length = 0;
  const st = (await chrome.storage.local.get('S:' + key))['S:' + key];
  if (st) {
    S.tr = st.tr || {}; S.deck = st.deck || null; S.chat = st.chat || []; S.overall = st.overall || '';
    if (st.sumSeg === cfg.segMin) { S.sum = st.sum || {}; for (const i in S.sum) if (S.sum[i].status === 'run') S.sum[i].status = S.sum[i].md ? 'done' : 'idle'; }
  }
  if (!S.deck && pendingDeck) { S.deck = pendingDeck; pendingDeck = null; }
  $('title').textContent = S.title || 'LectureLens';
  renderSubs(); renderSums(); renderChat(); renderDeck(); status();
  const p = pendingCues.get(key);
  if (p) applyCues(p.source, p.cues);
}

function status() {
  if (!S.key) return;
  const n = S.units.length;
  const done = S.units.filter((u) => S.tr[ukey(u)]).length;
  let s = n ? `${S.source} · ${n} 句` : (S.noCap ? '没有字幕，仅根据画面总结' : '等待字幕…');
  if (n && cfg.apiKey) s += ` · 已翻译 ${Math.round((done / n) * 100)}%`;
  if (S.dur) s += ` · ${fmt(S.t)} / ${fmt(S.dur)} · ${S.rate}x`;
  $('status').textContent = s;
}

// ---------------------------------------------------------------- cues
const pendingCues = new Map();
function applyCues(source, raw) {
  if (source === S.source && raw.length <= S.rawLen) return;
  if (S.source && source !== S.source && raw.length < S.rawLen * 0.8 && source !== '导入的字幕文件') return;
  S.source = source; S.rawLen = raw.length;
  S.units = mergeCues(raw);
  S.noCap = false;
  S.act = -1;
  buildSegs(); renderSubs(); renderSums(); onTime(); status(); pump();
}

function buildSegs() {
  S.segs = [];
  const L = cfg.segMin * 60;
  if (!S.units.length) {
    // No captions at all: split by video length and work from screenshots only.
    if (S.noCap && S.dur > 0) for (let i = 0; i * L < S.dur; i++) S.segs.push({ i, s: i * L, e: Math.min(S.dur, (i + 1) * L) });
    return;
  }
  const end = S.units[S.units.length - 1].e;
  for (let i = 0; i * L < end; i++) {
    const s = i * L, e = Math.min(end, (i + 1) * L);
    if (S.units.some((u) => u.s >= s && u.s < e)) S.segs.push({ i, s, e });
  }
}
const segOf = (t) => Math.floor(t / (cfg.segMin * 60));

function findAct(t) {
  const u = S.units;
  let lo = 0, hi = u.length - 1, a = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (u[m].s <= t) { a = m; lo = m + 1; } else hi = m - 1; }
  return a;
}

// ---------------------------------------------------------------- subtitles view
let rows = [];
function renderSubs() {
  const box = $('subs');
  if (!S.units.length) return;
  box.textContent = '';
  rows = S.units.map((u, i) => {
    const r = el('div', 'cue');
    r.dataset.i = i;
    r.append(el('div', 'tm', fmt(u.s)), el('div', 'zh', S.tr[ukey(u)] || ''), el('div', 'en', u.t));
    box.appendChild(r);
    return r;
  });
}
$('subs').addEventListener('click', (e) => {
  const r = e.target.closest('.cue');
  if (r) cmd({ type: 'll-seek', t: S.units[+r.dataset.i].s + 0.01 });
});
$('showEn').addEventListener('change', (e) => document.body.classList.toggle('noen', !e.target.checked));

let lastOv = '';
function pushOverlay(force) {
  const u = S.units[S.act];
  const on = u && S.t <= u.e + 1.5;
  const en = on ? u.t : '', zh = on ? (S.tr[ukey(u)] || '') : '';
  const sig = cfg.overlay + '|' + en + '|' + zh;
  if (!force && sig === lastOv) return;
  lastOv = sig;
  cmd({ type: 'll-overlay', mode: cfg.overlay, en, zh });
}

function onTime() {
  const a = findAct(S.t);
  if (a !== S.act) {
    if (rows[S.act]) rows[S.act].classList.remove('act');
    S.act = a;
    if (rows[a]) {
      rows[a].classList.add('act');
      if ($('follow').checked && $('v-sub').classList.contains('on')) rows[a].scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    pump();
  }
  pushOverlay(false);
  // auto summary when the playhead reaches the end of a segment
  const cur = segOf(S.t);
  if (cur !== curSeg) { curSeg = cur; document.querySelectorAll('.seg').forEach((d) => d.classList.toggle('cur', +d.dataset.i === cur)); }
  if (cfg.autoSummary && cfg.apiKey && !S.paused) {
    const seg = S.segs.find((x) => x.i === cur);
    if (seg && S.t >= seg.e - 4 && seg.e - seg.s > 45 && !(S.sum[cur] && (S.sum[cur].md || S.sum[cur].status === 'run' || S.sum[cur].err))) queueSeg(cur, false);
  }
}
let curSeg = -1;

// ---------------------------------------------------------------- translation
const BATCH = 24;
let trFails = {};
const trBusy = new Set();
function pickBatch() {
  const nb = Math.ceil(S.units.length / BATCH);
  if (!nb) return null;
  const cur = Math.max(0, Math.floor(Math.max(0, S.act) / BATCH));
  const order = [];
  for (let b = cur; b < nb; b++) order.push(b);
  for (let b = cur - 1; b >= 0; b--) order.push(b);
  for (const b of order) {
    if (trBusy.has(b) || (trFails[b] || 0) >= 2) continue;
    const us = S.units.slice(b * BATCH, (b + 1) * BATCH);
    if (us.some((u) => !S.tr[ukey(u)])) return b;
  }
  return null;
}
function pump() {
  if (!cfg.autoTranslate || !cfg.apiKey || !S.units.length) return;
  while (trBusy.size < 2) {
    const b = pickBatch();
    if (b == null) break;
    runBatch(b);
  }
  $('retryTr').hidden = !Object.values(trFails).some((n) => n >= 2);
}
async function runBatch(b) {
  const sid = S.sid;
  trBusy.add(b);
  const start = b * BATCH;
  const us = S.units.slice(start, start + BATCH);
  const prev = S.units.slice(Math.max(0, start - 2), start).map((u) => u.t).join(' ');
  const gloss = deckNear(us.map((u) => u.t).join(' '), 1500);
  const system = `你是大学课程的同声传译。把带编号的课堂字幕（自动语音识别，可能有错词、断句不整齐）翻译成${cfg.lang}。
要求：逐条对应，不合并、不拆分、不遗漏编号；口语转成通顺自然的表达，去掉 um/uh 等口头语；专业术语译出并在括号里保留英文原词，如“卷积（convolution）”；结合上下文和课件纠正明显的识别错误。
只输出译文，每条一行，格式严格为：编号<TAB>译文。不要输出任何其他内容。`;
  const text = (gloss ? `【课件术语参考】\n${gloss}\n\n` : '') + (prev ? `【上文（不要翻译）】${prev}\n\n` : '') + '【待翻译】\n' + us.map((u, k) => `${k + 1}\t${u.t}`).join('\n');
  try {
    const out = await llm({ system, parts: [{ text }], maxTokens: 4000 });
    if (sid !== S.sid) return;
    let got = 0;
    for (const line of out.split('\n')) {
      const m = line.match(/^\s*\[?(\d+)\]?\s*[\t|:：.、)]\s*(.+)$/);
      if (!m) continue;
      const u = us[+m[1] - 1];
      if (!u) continue;
      S.tr[ukey(u)] = m[2].trim();
      const r = rows[start + (+m[1] - 1)];
      if (r) r.children[1].textContent = m[2].trim();
      got++;
    }
    if (got < us.length) trFails[b] = (trFails[b] || 0) + 1;
    save(); status(); pushOverlay(false);
  } catch (e) {
    if (sid !== S.sid) return;
    trFails[b] = (trFails[b] || 0) + 1;
    $('status').textContent = '翻译出错：' + e.message;
    await sleep(1500);
  } finally {
    if (sid === S.sid) { trBusy.delete(b); pump(); }
  }
}
$('retryTr').addEventListener('click', () => { trFails = {}; pump(); });

// ---------------------------------------------------------------- frames
function sigChanged(a, b) {
  if (!a || !b || a.length !== b.length) return true;
  for (let k = 0; k < a.length; k++) {
    let d = 0;
    for (let i = 0; i < a[k].length; i++) d += Math.abs(a[k][i] - b[k][i]);
    if (d / a[k].length > 9) return true;
  }
  return false;
}
function keepFrame(f) {
  const i = segOf(f.t);
  const arr = (S.fbs[i] = S.fbs[i] || []);
  if (arr.includes(f)) return;
  arr.push(f);
  if (arr.length > 4) arr.shift();
}
async function shrink(dataUrl, maxW) {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
  const sc = Math.min(1, maxW / img.width);
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.72);
}
async function captureNow() {
  if (!cfg.vision || S.vTab == null) return null;
  if (!S.tainted) {
    const r = await cmd({ type: 'll-capture' });
    if (r && r.images) return { t: r.t, images: r.images, sigs: r.sigs };
    if (r && r.error === 'tainted') S.tainted = true;
    else return null;
  }
  try { // video is cross-origin protected: fall back to a screenshot of the visible tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.id !== S.vTab) return null;
    const shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 75 });
    return { t: S.t, images: [await shrink(shot, 1400)], sigs: null };
  } catch (e) { return null; }
}
setInterval(async () => {
  if (!cfg.vision || !cfg.apiKey || S.paused || !S.key || S.tainted || Date.now() - S.lastTick > 3000) return;
  const sid = S.sid;
  const f = await captureNow();
  if (!f || sid !== S.sid || S.tainted) return;
  // a big change means the slide flipped: keep the last view of the old slide (it has all the annotations)
  if (S.lastFrame && (sigChanged(S.lastFrame.sigs, f.sigs) || segOf(S.lastFrame.t) !== segOf(f.t))) keepFrame(S.lastFrame);
  S.lastFrame = f;
}, 12000);

// ---------------------------------------------------------------- summaries
function deckText(limit) {
  if (!S.deck) return '';
  const per = Math.max(40, Math.floor(limit / S.deck.pages.length) - 8);
  const total = S.deck.pages.reduce((n, p) => n + p.length, 0);
  return S.deck.pages.map((p, i) => `[P${i + 1}] ${total > limit ? p.slice(0, per) : p}`).join('\n').slice(0, limit + 2000);
}
// the few slides that share the most words with a piece of transcript (terminology reference for translation)
function deckNear(text, limit) {
  if (!S.deck) return '';
  const words = new Set((text.toLowerCase().match(/[a-z]{5,}/g) || []));
  if (!words.size) return '';
  const scored = S.deck.pages.map((p, i) => {
    const pw = new Set(p.toLowerCase().match(/[a-z]{5,}/g) || []);
    let n = 0; for (const w of pw) if (words.has(w)) n++;
    return { i, n, p };
  }).filter((x) => x.n >= 2).sort((a, b) => b.n - a.n).slice(0, 3).sort((a, b) => a.i - b.i);
  const per = Math.floor(limit / 3);
  return scored.map((x) => `[P${x.i + 1}] ${x.p.slice(0, per)}`).join('\n');
}

const sumQueue = [];
let sumRunning = false;
function queueSeg(i, manual) {
  if (sumQueue.some((q) => q.i === i)) return;
  if (S.sum[i] && S.sum[i].status === 'run') return;
  S.sum[i] = { ...(S.sum[i] || {}), status: 'run', err: '' };
  renderSeg(i);
  sumQueue.push({ i, manual, sid: S.sid });
  drain();
}
async function drain() {
  if (sumRunning) return;
  sumRunning = true;
  while (sumQueue.length) {
    const q = sumQueue.shift();
    if (q.sid !== S.sid) continue;
    await genSeg(q.i);
  }
  sumRunning = false;
}
async function genSeg(i) {
  const sid = S.sid;
  const seg = S.segs.find((x) => x.i === i);
  if (!seg) return;
  const us = S.units.filter((u) => u.s >= seg.s && u.s < seg.e);
  let frames = (S.fbs[i] || []).slice();
  if (S.lastFrame && segOf(S.lastFrame.t) === i && !frames.includes(S.lastFrame)) frames.push(S.lastFrame);
  if (!frames.length && segOf(S.t) === i) { const f = await captureNow(); if (f) frames.push(f); }
  if (sid !== S.sid) return;
  const shotsOnly = !us.length;
  const images = frames.slice(shotsOnly ? -4 : -3).flatMap((f) => f.images).slice(shotsOnly ? -8 : -6);
  if (shotsOnly && !images.length) {
    S.sum[i] = { ...(S.sum[i] || {}), status: 'idle', err: cfg.vision ? '这一段既没有字幕也没有截图：先播放这一段，或点“扫描整节课”。' : '这个视频没有字幕，只能靠画面总结：请先在设置里打开“截取视频画面”。' };
    renderSeg(i);
    return;
  }
  const prevMd = S.sum[i - 1] && S.sum[i - 1].md ? S.sum[i - 1].md.slice(0, 500) : '';
  const system = `你是一名助教，帮母语为中文的学生整理英文授课的课堂内容。用${cfg.lang}输出，专业术语首次出现时附英文原词。只依据提供的字幕、课件和截图，不要编造老师没讲的内容；字幕来自自动语音识别，遇到明显错词请按上下文纠正。`;
  const ask = `下面是课堂 ${fmt(seg.s)}–${fmt(seg.e)} 这一段的字幕${images.length ? '，以及这段时间的视频截图（可能包含 PPT、板书、老师的手写标注）' : ''}。请输出这一段的学习笔记（Markdown）：

#### 用一句话概括这段的主题
- 3–7 条要点：讲清概念、推导思路、例子和结论，而不是复述原话；重要处在句末标注时间点，格式 [mm:ss]
- 公式一律用 LaTeX：行内写成 $...$，独立成行写成 $$...$$，不要放进代码块；需要并列对比时可以用 Markdown 表格

之后按需添加（没有就整项省略，不要写“无”）：
**板书/标注**：截图里老师手写、圈画的内容，或 PPT 上没有、只在口头补充的关键信息
**对应课件**：P几–P几（仅在提供了课件时）
**考试/作业提示**：老师明确提到考试、作业、重点时才写

保持精炼，不要开场白和结束语。`;
  const askShots = `这个视频没有字幕。下面是课堂 ${fmt(seg.s)}–${fmt(seg.e)} 这段时间按先后顺序截取的画面（可能包含 PPT、板书、老师的手写标注，也可能有老师本人的镜头）。请只根据画面里看得见的内容输出这一段的学习笔记（Markdown）：

#### 用一句话概括这段的主题
- 3–7 条要点：把画面上的概念、定义、公式、图表结论、例子整理清楚并补上必要的解释，让没看视频的人也能看懂
- 公式一律用 LaTeX：行内写成 $...$，独立成行写成 $$...$$，不要放进代码块；需要并列对比时可以用 Markdown 表格

之后按需添加（没有就整项省略，不要写“无”）：
**板书/标注**：老师手写、圈画的内容
**对应课件**：P几–P几（仅在提供了课件时）

注意：你听不到老师讲的话，不要猜测或编造口头内容；看不清的文字写“（看不清）”，不要臆测；只有老师镜头、没有可读内容的画面直接忽略。保持精炼，不要开场白和结束语。`;
  const parts = [];
  if (S.deck) parts.push({ text: `【本节课课件文字（${S.deck.name}）】\n${deckText(24000)}` });
  if (prevMd) parts.push({ text: `【上一段的笔记，供衔接参考】\n${prevMd}` });
  images.forEach((im) => parts.push({ image: im }));
  parts.push({ text: shotsOnly ? askShots : `【字幕】\n${us.map((u) => `[${fmt(u.s)}] ${u.t}`).join('\n')}\n\n${ask}` });
  let md, usedImages = images, note = '';
  try {
    try { md = await llm({ system, parts, smart: true }); }
    catch (e) {
      if (!images.length) throw e;
      if (shotsOnly) throw new Error('这个视频没有字幕，只能靠画面总结，但当前模型没能读取截图（需要支持图片输入的模型）：' + e.message.slice(0, 120));
      md = await llm({ system, parts: parts.filter((p) => !p.image), smart: true });
      usedImages = []; note = '（当前模型未能读取截图，本段仅根据字幕生成：' + e.message.slice(0, 80) + '）';
    }
    if (sid !== S.sid) return;
    S.sum[i] = { md, frames: usedImages, status: 'done', note };
  } catch (e) {
    if (sid !== S.sid) return;
    S.sum[i] = { ...(S.sum[i] || {}), status: 'idle', err: e.message };
  }
  renderSeg(i); save();
}

function esc(s) { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
// Markdown -> HTML: marked for structure (tables, nested lists…), KaTeX for formulas, DOMPurify to sanitise.
// opts.mathml = true renders formulas as MathML so a standalone .html file needs no KaTeX stylesheet.
function md2html(src, opts = {}) {
  const hold = [];
  const keep = (kind, v, display) => { hold.push({ kind, v, display }); return `\u0001${hold.length - 1}\u0002`; };
  let s = String(src).replace(/\r/g, '');
  // 1) set code aside so nothing below touches it
  s = s.replace(/```[\s\S]*?```/g, (m) => keep('code', m)).replace(/`[^`\n]+`/g, (m) => keep('code', m));
  // 2) formulas
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_m, x) => keep('math', x, true))
    .replace(/\\\[([\s\S]+?)\\\]/g, (_m, x) => keep('math', x, true))
    .replace(/\\\(([\s\S]+?)\\\)/g, (_m, x) => keep('math', x, false))
    .replace(/\$(?!\s)([^$\n]{1,400}?)(?<!\s)\$(?!\d)/g, (_m, x) => keep('math', x, false));
  // 3) timestamps -> links
  s = s.replace(/\[L(\d+)\s+(\d{1,2}:\d{2}(?::\d{2})?)\]/g, '<a data-lec="$1" data-t="$2">L$1 $2</a>')
    .replace(/\[(\d{1,2}:\d{2}(?::\d{2})?)\](?!\()/g, '<a data-t="$1">$1</a>');
  // 4) code back in, then Markdown
  s = s.replace(/\u0001(\d+)\u0002/g, (m, i) => (hold[+i].kind === 'code' ? hold[+i].v : m));
  let html = globalThis.marked.parse(s, { gfm: true, breaks: true });
  html = globalThis.DOMPurify.sanitize(html, { FORBID_TAGS: ['style', 'form', 'input', 'img', 'iframe'], FORBID_ATTR: ['style', 'id', 'class'] });
  // 5) formulas in (KaTeX output is generated locally, so it goes in after sanitising)
  html = html.replace(/\u0001(\d+)\u0002/g, (_m, i) => {
    const h = hold[+i];
    try { return globalThis.katex.renderToString(h.v.trim(), { displayMode: !!h.display, throwOnError: false, output: opts.mathml ? 'mathml' : 'html' }); }
    catch (e) { return '<code>' + esc(h.v) + '</code>'; }
  });
  return html.replace(/<table>/g, '<div class="tbl"><table>').replace(/<\/table>/g, '</table></div>');
}
const tsToSec = (s) => s.split(':').reduce((a, b) => a * 60 + +b, 0);

function segNode(seg) {
  const d = el('div', 'seg');
  d.dataset.i = seg.i;
  d.id = 'seg-' + seg.i;
  if (seg.i === curSeg) d.classList.add('cur');
  const st = S.sum[seg.i] || {};
  const hd = el('div', 'hd');
  const a = el('a', '', `${fmt(seg.s)} – ${fmt(seg.e)}`);
  a.dataset.t = fmt(seg.s);
  hd.append(a, el('span', 'grow'));
  if (st.status === 'run') hd.append(el('span', 'hint', '生成中…'));
  else { const b = el('button', 'link', st.md ? '重新生成' : '总结这一段'); b.dataset.gen = seg.i; hd.append(b); }
  d.append(hd);
  if (st.err) d.append(el('div', 'err', st.err));
  if (st.md) { const m = el('div', 'md'); m.innerHTML = md2html(st.md); d.append(m); }
  if (st.note) d.append(el('div', 'hint', st.note));
  if (st.frames && st.frames.length) {
    const th = el('div', 'thumbs');
    st.frames.forEach((src) => { const im = el('img'); im.src = src; th.append(im); });
    d.append(th);
  }
  return d;
}
function renderSeg(i) {
  const seg = S.segs.find((x) => x.i === i);
  const old = $('seg-' + i);
  if (seg && old) old.replaceWith(segNode(seg));
  else renderSums();
}
function renderSums() {
  const box = $('sums');
  if (!S.segs.length) return;
  box.textContent = '';
  if (S.overall) {
    const d = el('div', 'seg');
    d.append(el('div', 'hd', '')); d.firstChild.append(el('b', '', '整课笔记'));
    const m = el('div', 'md'); m.innerHTML = md2html(S.overall); d.append(m);
    box.append(d);
  }
  S.segs.forEach((seg) => box.append(segNode(seg)));
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-t]');
  if (a) {
    const t = tsToSec(a.dataset.t);
    const key = a.dataset.key || (a.dataset.lec && libLecs[+a.dataset.lec - 1] && libLecs[+a.dataset.lec - 1].key);
    if (key && key !== S.key) chrome.tabs.create({ url: key + '#ll-t=' + Math.floor(t) });
    else cmd({ type: 'll-seek', t });
    return;
  }
  const g = e.target.closest('button[data-gen]');
  if (g) { queueSeg(+g.dataset.gen, true); return; }
  if (e.target.matches('.thumbs img')) e.target.classList.toggle('big');
});
$('sumAll').addEventListener('click', () => {
  if (!needKey()) return;
  S.segs.forEach((seg) => { if (!(S.sum[seg.i] && S.sum[seg.i].md)) queueSeg(seg.i, true); });
});
function needKey() {
  if (cfg.apiKey) return true;
  showTab('set'); $('apiKey').focus();
  return false;
}

async function genOverall() {
  if (!needKey() || !S.segs.length) return;
  const sid = S.sid;
  const btn = $('overall');
  btn.disabled = true; btn.textContent = '生成中…';
  try {
    S.segs.forEach((seg) => { if (!(S.sum[seg.i] && S.sum[seg.i].md)) queueSeg(seg.i, true); });
    while (sid === S.sid && (sumRunning || sumQueue.length)) await sleep(500);
    if (sid !== S.sid) return;
    const notes = S.segs.filter((s) => S.sum[s.i] && S.sum[s.i].md).map((s) => `## ${fmt(s.s)}–${fmt(s.e)}\n${S.sum[s.i].md}`).join('\n\n');
    if (!notes) throw new Error('分段总结都没有生成成功，请先检查接口设置');
    const system = `你是一名助教，为母语为中文的学生把一节英文授课的课整理成复习笔记。用${cfg.lang}输出 Markdown，术语附英文原词。只依据给出的分段笔记和课件，不要编造。`;
    const parts = [];
    if (S.deck) parts.push({ text: `【课件文字】\n${deckText(12000)}` });
    parts.push({ text: `【分段笔记】\n${notes}\n\n公式一律用 LaTeX（行内 $...$，独立成行 $$...$$）；术语表等适合用 Markdown 表格。请输出整节课的复习笔记：\n## 本节概览（3–5 句）\n## 知识结构（分层列表，标出各部分的先后与依赖关系）\n## 关键术语与公式（术语：中文 / English / 一句话解释）\n## 易混淆与易错点\n## 老师提到的考试、作业、重点（没有就省略此节）\n## 自测题（5 题，题后附简要答案）` });
    const md = await llm({ system, parts, smart: true, maxTokens: 4000 });
    if (sid !== S.sid) return;
    S.overall = md; save(); renderSums(); $('sums').scrollTop = 0;
  } catch (e) {
    $('status').textContent = '整课笔记生成失败：' + e.message;
  } finally { btn.disabled = false; btn.textContent = '生成整课笔记'; }
}
$('overall').addEventListener('click', genOverall);

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
const safeName = () => (S.title || 'lecture').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60) || 'lecture';
function exportMd() {
  let md = `# ${S.title || L('课堂笔记', 'Lecture notes')}\n\n> ${S.key || ''} · ${L('导出于', 'exported')} ${new Date().toLocaleString()}\n\n`;
  if (S.overall) md += S.overall + '\n\n---\n\n';
  md += L('# 分段笔记', '# Notes by segment') + '\n\n';
  for (const seg of S.segs) { const st = S.sum[seg.i]; if (st && st.md) md += `### ⏱ [${fmt(seg.s)} – ${fmt(seg.e)}](${S.key}#ll-t=${Math.floor(seg.s)})\n\n${st.md}\n\n`; }
  download(safeName() + L(' 笔记', ' notes') + '.md', md, 'text/markdown');
}
// every timestamp becomes a link back to that moment of the recording (opened via "#ll-t=seconds")
const tsLink = (t) => esc(S.key) + '#ll-t=' + Math.floor(t);
const linkify = (html) => html.replace(/<a data-t="([\d:]+)">/g, (_m, ts) => `<a href="${tsLink(tsToSec(ts))}">`);
function notesBody(mathml) {
  const md2 = (x) => md2html(x, { mathml });
  let body = `<h1>${esc(S.title || L('课堂笔记', 'Lecture notes'))}</h1><p class="src"><a href="${esc(S.key || '')}">${esc(S.key || '')}</a> · ${L('导出于', 'exported')} ${esc(new Date().toLocaleString())} · ${L('点击时间可跳回录播对应位置', 'click a timestamp to jump back to that moment in the recording')}</p>`;
  if (S.overall) body += `<section>${linkify(md2(S.overall))}</section><hr>`;
  for (const seg of S.segs) {
    const st = S.sum[seg.i];
    if (!st || !st.md) continue;
    body += `<section><h2><a href="${tsLink(seg.s)}">⏱ ${fmt(seg.s)} – ${fmt(seg.e)}</a></h2>${linkify(md2(st.md))}${(st.frames || []).map((f) => `<img src="${f}">`).join('')}</section>`;
  }
  return body;
}
async function exportPdf() {
  if (!S.segs.some((s) => S.sum[s.i] && S.sum[s.i].md)) { $('status').textContent = '还没有可导出的笔记，先生成总结。'; return; }
  await chrome.storage.local.set({ EXPORT: { title: safeName() + L(' 笔记', ' notes'), body: notesBody(), lang: globalThis.LLi18n.lang } });
  chrome.tabs.create({ url: chrome.runtime.getURL('export.html') });
}
function exportHtml() {
  const body = notesBody(true);
  const html = `<!doctype html><html lang="${L('zh-CN', 'en')}"><meta charset="utf-8"><title>${esc(S.title || L('课堂笔记', 'Lecture notes'))}</title><style>body{max-width:820px;margin:32px auto;padding:0 18px;font:15px/1.7 system-ui,"PingFang SC","Microsoft YaHei",sans-serif;color:#1d1f23}h1{font-size:24px}h2{font-size:17px;margin-top:28px;border-bottom:1px solid #ddd;padding-bottom:4px}h3,h4{font-size:15px}img{max-width:100%;border:1px solid #ddd;border-radius:6px;margin:8px 0;display:block}code{background:#eef2ff;padding:0 4px;border-radius:4px}pre{background:#eef2ff;padding:10px;border-radius:6px;overflow:auto}table{border-collapse:collapse;margin:10px 0}th,td{border:1px solid #ccc;padding:5px 9px;text-align:left;vertical-align:top}th{background:#f3f4f6}.tbl{overflow-x:auto}math[display=block]{margin:10px 0}.src{color:#777;font-size:13px}a{color:#2563eb;text-decoration:none}</style><body>${body}</body></html>`;
  download(safeName() + L(' 笔记', ' notes') + '.html', html, 'text/html');
}
$('expPdf').addEventListener('click', exportPdf);
$('expMd').addEventListener('click', exportMd);
$('expHtml').addEventListener('click', exportHtml);

// ---------------------------------------------------------------- chat
function renderChat() {
  const box = $('chat');
  if (!S.chat.length) return;
  box.textContent = '';
  for (const m of S.chat) {
    const d = el('div', 'msg ' + (m.role === 'user' ? 'u' : 'a'));
    if (m.role === 'user') d.textContent = m.text; else { d.classList.add('md'); d.innerHTML = md2html(m.text); }
    box.append(d);
  }
  box.scrollTop = box.scrollHeight;
}
async function ask() {
  const q = $('q').value.trim();
  if (!q || !needKey()) return;
  const sid = S.sid;
  $('q').value = '';
  const history = S.chat.slice(-6).map((m) => ({ role: m.role, content: m.text }));
  S.chat.push({ role: 'user', text: q });
  S.chat.push({ role: 'assistant', text: L('思考中…', 'Thinking…') });
  renderChat();
  const near = S.units.filter((u) => u.s >= S.t - 240 && u.s <= S.t + 30).map((u) => `[${fmt(u.s)}] ${u.t}`).join('\n');
  const sums = S.segs.filter((s) => S.sum[s.i] && S.sum[s.i].md).map((s) => `(${fmt(s.s)}–${fmt(s.e)}) ${S.sum[s.i].md}`).join('\n\n').slice(-14000);
  const parts = [];
  if (S.deck) parts.push({ text: `【课件文字（${S.deck.name}）】\n${deckText(16000)}` });
  if (sums) parts.push({ text: `【已生成的分段笔记】\n${sums}` });
  if (near) parts.push({ text: `【当前播放位置 ${fmt(S.t)} 附近的字幕】\n${near}` });
  let frame = null;
  if ($('withFrame').checked) { frame = await captureNow(); if (frame) frame.images.slice(0, 2).forEach((im) => parts.push({ image: im })); }
  parts.push({ text: `【学生的问题】${q}` });
  const system = `你是这门课的助教，学生正在看英文授课的录播。用${cfg.lang}回答，术语附英文原词。优先依据提供的字幕、课件、笔记和当前画面作答，并指出依据的时间点 [mm:ss] 或课件页码；材料里没有的内容可以用你的知识补充，但要说明这是补充而非老师所讲。回答直接、具体。公式用 LaTeX（行内 $...$，独立成行 $$...$$）。`;
  let ans;
  try {
    try { ans = await llm({ system, parts, history, smart: true }); }
    catch (e) { if (!frame) throw e; ans = await llm({ system, parts: parts.filter((p) => !p.image), history, smart: true }); }
  } catch (e) { ans = L('出错了：', 'Error: ') + globalThis.LLi18n.text(e.message); }
  if (sid !== S.sid) return;
  S.chat[S.chat.length - 1].text = ans;
  renderChat(); save();
}
$('askBtn').addEventListener('click', ask);
$('q').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(); } });
$('clearChat').addEventListener('click', () => { S.chat = []; $('chat').textContent = ''; save(); });

// ---------------------------------------------------------------- deck / subtitle import
async function readPdf(file) {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const tc = await (await doc.getPage(n)).getTextContent();
    pages.push(tc.items.map((it) => it.str + (it.hasEOL ? '\n' : ' ')).join('').replace(/[ \t]+/g, ' ').trim());
  }
  return pages;
}
async function readPptx(file) {
  const zip = await globalThis.JSZip.loadAsync(await file.arrayBuffer());
  const names = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => +a.match(/(\d+)\.xml/)[1] - +b.match(/(\d+)\.xml/)[1]);
  const pages = [];
  for (const n of names) {
    const xml = await zip.files[n].async('string');
    const paras = xml.split(/<\/a:p>/).map((p) => [...p.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((m) => m[1]).join('')).filter((s) => s.trim());
    pages.push(paras.join('\n').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
  }
  return pages;
}
function renderDeck(msg) {
  const d = S.deck || pendingDeck;
  $('deckInfo').textContent = msg || (d ? `已载入课件：${d.name}（${d.pages.length} 页，${d.pages.reduce((n, p) => n + p.length, 0)} 字符）` : '尚未上传课件。');
}
$('file').addEventListener('change', async (e) => {
  let batchDeck = null;
  for (const file of e.target.files) {
    const ext = file.name.split('.').pop().toLowerCase();
    try {
      if (ext === 'vtt' || ext === 'srt') {
        const cues = parseAny(await file.text());
        if (cues.length < 3) throw new Error('没有解析出字幕');
        if (!S.key) throw new Error('请先打开并播放视频，再导入字幕');
        S.source = ''; S.rawLen = 0;
        applyCues('导入的字幕文件', cues);
        renderDeck(`已导入字幕 ${file.name}（${cues.length} 条）`);
        continue;
      }
      let pages;
      if (ext === 'pdf') pages = await readPdf(file);
      else if (ext === 'pptx') pages = await readPptx(file);
      else pages = (await file.text()).split(/\n{3,}/);
      const chars = pages.reduce((n, p) => n + p.length, 0);
      if (chars < 30) throw new Error('没有提取到文字（可能是扫描版/纯图片课件）。这种情况可以依靠“截取视频画面”来读课件');
      const prev = batchDeck; // several files picked together are joined into one deck
      const deck = prev ? { name: prev.name + ' + ' + file.name, pages: prev.pages.concat(pages) } : { name: file.name, pages };
      batchDeck = deck;
      if (S.key) { S.deck = deck; save(); } else pendingDeck = deck;
      renderDeck();
    } catch (err) { renderDeck(`${file.name} 读取失败：${err.message}`); }
  }
  e.target.value = '';
});

// ---------------------------------------------------------------- whole-lecture scan
let scanning = false, scanPct = '', scanned = new Set();
function scanBtn() { $('scan').textContent = scanning ? `扫描中 ${scanPct}（点击停止）` : '扫描整节课'; $('scan').classList.toggle('on', scanning); }
$('scan').addEventListener('click', async () => {
  if (scanning) { cmd({ type: 'll-scan-stop' }); return; }
  if (!S.key || !S.dur) { $('status').textContent = '先打开录播并让视频加载出来，再扫描。'; return; }
  if (!cfg.vision) { $('status').textContent = '设置里关闭了“截取视频画面”，扫描没有意义；可直接点“总结全部”。'; return; }
  // A few fixed shots per segment instead of sampling the whole timeline; segments that already
  // have screenshots (from watching or an earlier scan) are skipped.
  const fr = !S.units.length ? [0.2, 0.47, 0.74, 0.97] // no captions: screenshots are the only source, so take more
    : ({ 1: [0.9], 2: [0.45, 0.95], 3: [0.3, 0.65, 0.97] }[cfg.scanShots] || [0.45, 0.95]);
  const times = [], groups = [];
  scanned = new Set();
  for (const seg of S.segs) {
    const st = S.sum[seg.i];
    if ((st && st.frames && st.frames.length) || (S.fbs[seg.i] || []).length >= fr.length) continue;
    scanned.add(seg.i);
    fr.forEach((f) => { times.push(Math.min(seg.s + f * (seg.e - seg.s), S.dur - 1)); groups.push(seg.i); });
  }
  if (!times.length) { $('status').textContent = '每个分段都已经有截图了，不需要再扫描。'; return; }
  scanning = true; scanPct = `0/${times.length}`; scanBtn();
  const r = await cmd({ type: 'll-scan-start', times, groups });
  if (!r || !r.ok) { scanning = false; scanBtn(); $('status').textContent = '无法开始扫描，刷新录播页面后再试。'; }
});

// ---------------------------------------------------------------- whole-course search & Q&A
let libLecs = [];
const short = (s, n) => (s.length > n ? s.slice(0, n) + '…' : s);
function libCourses() {
  const cs = [...new Set(Object.values(IDX).map((x) => x.course))].sort();
  const sel = $('libCourse');
  const want = sel.value || S.course;
  sel.textContent = '';
  cs.forEach((c) => { const o = el('option', '', c); o.value = c; sel.append(o); });
  if (cs.includes(want)) sel.value = want;
  const n = Object.values(IDX).filter((x) => x.course === sel.value).length;
  $('libInfo').textContent = cs.length ? `已收录 ${n} 节` : '';
  return sel.value;
}
async function libLoad() {
  const course = libCourses();
  const keys = Object.keys(IDX).filter((k) => IDX[k].course === course)
    .sort((a, b) => IDX[a].title.localeCompare(IDX[b].title, undefined, { numeric: true }));
  const got = keys.length ? await chrome.storage.local.get(keys.map((k) => 'T:' + k)) : {};
  libLecs = keys.map((k) => ({ key: k, ...(got['T:' + k] || {}) })).filter((l) => l.units && (l.units.length || (l.sums || []).length));
  libLecs.forEach((l, i) => { l.n = i + 1; });
  return libLecs;
}
async function libShowList() {
  if (S.key) { clearTimeout(saveTimer); await persist(); }
  const lecs = await libLoad();
  const box = $('libOut');
  box.textContent = '';
  if (!lecs.length) { box.append(el('p', 'hint', '还没有收录任何课次。每打开并加载过字幕的一节录播，都会自动收进这里（按课程代码归类）；之后就能跨课次搜索和提问。升级到这个版本之前看过的课，需要重新打开一次才会收录。')); return; }
  for (const l of lecs) {
    const d = el('div', 'lec');
    const a = el('a', 't', l.title || l.key);
    a.dataset.key = l.key; a.dataset.t = '0:00';
    d.append(el('span', 'n', 'L' + l.n), a, el('span', 'hint', `${fmt(l.dur || (l.units.length ? l.units[l.units.length - 1].e : 0))} · 笔记 ${(l.sums || []).length} 段`));
    box.append(d);
  }
  box.append(el('p', 'hint', '搜索范围是字幕原文、译文和已生成的笔记。没翻译/没总结过的课只能用英文关键词搜到。'));
}
function libChunks(lecs) {
  const out = [];
  for (const L of lecs) {
    let cur = null;
    for (const u of L.units) {
      if (!cur || u.s - cur.s > 75) { cur = { L, s: u.s, e: u.e, en: '', zh: '', kind: 't' }; out.push(cur); }
      cur.e = u.e; cur.en += (cur.en ? ' ' : '') + u.t; if (u.z) cur.zh += u.z;
    }
    for (const m of L.sums || []) out.push({ L, s: m.s, e: m.e, en: '', zh: m.md, kind: 's' });
  }
  out.forEach((c) => { c.lc = (c.en + ' ' + c.zh).toLowerCase(); });
  return out;
}
function libScore(chunks, terms) {
  terms = [...new Set(terms.map((t) => t.toLowerCase().trim()).filter((t) => t.length > 1 || /[\u4e00-\u9fff]/.test(t)))];
  const df = terms.map((t) => chunks.filter((c) => c.lc.includes(t)).length);
  return chunks.map((c) => {
    let sc = 0;
    terms.forEach((t, i) => {
      if (!df[i]) return;
      let n = 0, p = -1;
      while (n < 3 && (p = c.lc.indexOf(t, p + 1)) >= 0) n++;
      if (n) sc += (1 + 0.5 * (n - 1)) * Math.log(1 + chunks.length / df[i]) * (c.kind === 's' ? 1.2 : 1);
    });
    return { c, sc };
  }).filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc);
}
const splitTerms = (q) => q.split(/[\s,，、;；]+/).filter(Boolean);
function snippet(text, terms) {
  const lc = text.toLowerCase();
  let at = -1;
  for (const t of terms) { const p = lc.indexOf(t.toLowerCase()); if (p >= 0 && (at < 0 || p < at)) at = p; }
  const from = Math.max(0, at - 60);
  let s = esc((from > 0 ? '…' : '') + text.slice(from, from + 200).replace(/\s+/g, ' ') + (text.length > from + 200 ? '…' : ''));
  for (const t of terms) {
    if (!t) continue;
    s = s.replace(new RegExp(esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (m) => `<mark>${m}</mark>`);
  }
  return s;
}
async function libSearch() {
  const q = $('libQ').value.trim();
  if (!q) return libShowList();
  if (S.key) { clearTimeout(saveTimer); await persist(); }
  const lecs = await libLoad();
  const box = $('libOut');
  box.textContent = '';
  const terms = [...splitTerms(q), q];
  const hits = libScore(libChunks(lecs), terms).slice(0, 40);
  if (!hits.length) { box.append(el('p', 'hint', `在 ${lecs.length} 节课里没有找到“${q}”。字幕是英文的：没翻译过的课请换英文关键词，或用“问整门课”。`)); return; }
  box.append(el('p', 'hint', `${hits.length} 处匹配（按相关度排序），点时间跳转：`));
  for (const { c } of hits) {
    const d = el('div', 'hit');
    const w = el('div', 'where');
    const a = el('a', '', `${fmt(c.s)}`);
    a.dataset.key = c.L.key; a.dataset.t = fmt(c.s);
    w.append(a, document.createTextNode(' · ' + short(c.L.title || '', 46)), el('span', 'tag', c.kind === 's' ? '笔记' : '字幕'));
    const body = el('div', c.kind === 's' ? '' : 'en');
    const txt = c.kind === 's' ? c.zh : (terms.some((t) => c.en.toLowerCase().includes(t.toLowerCase())) ? c.en : c.zh || c.en);
    body.innerHTML = snippet(txt, splitTerms(q));
    d.append(w, body);
    box.append(d);
  }
}
async function libAsk() {
  const q = $('libQ').value.trim();
  if (!q || !needKey()) return;
  if (S.key) { clearTimeout(saveTimer); await persist(); }
  const lecs = await libLoad();
  const box = $('libOut');
  box.textContent = '';
  if (!lecs.length) return libShowList();
  box.append(el('p', 'hint', `正在 ${lecs.length} 节课里查找…`));
  try {
    let terms = splitTerms(q);
    try { // the question is usually Chinese and the lectures English: get bilingual search terms first
      const kw = await llm({ system: '你负责为课程录播的全文检索生成关键词。课程用英文授课。只输出关键词，用英文逗号分隔，不要解释。', parts: [{ text: `问题：${q}\n\n请给出最多 12 个检索词：以英文专业术语为主（含同义词、缩写、常见说法），再加上对应的中文术语。` }], maxTokens: 200 });
      terms = terms.concat(kw.split(/[,，\n]+/).map((x) => x.trim()).filter((x) => x && x.length < 40));
    } catch (e) {}
    const ranked = libScore(libChunks(lecs), terms);
    const picked = [];
    let chars = 0;
    for (const { c } of ranked) {
      const text = c.kind === 's' ? c.zh : c.en;
      if (chars + text.length > 18000 || picked.length >= 18) break;
      picked.push(c); chars += text.length;
    }
    if (!picked.length) { box.textContent = ''; box.append(el('p', 'hint', '在已收录的课次里没有检索到相关内容。可能这部分内容所在的课还没打开过。')); return; }
    picked.sort((a, b) => a.L.n - b.L.n || a.s - b.s);
    const ctx = picked.map((c) => `[L${c.L.n} ${fmt(c.s)}] (${c.kind === 's' ? '笔记' : '字幕'}) ${c.kind === 's' ? c.zh : c.en}`).join('\n\n');
    const cat = lecs.map((l) => `L${l.n} = ${l.title}`).join('\n');
    const system = `你是这门课的助教。下面是从整门课各节录播里检索出的片段（英文字幕来自自动语音识别，可能有错词）。用${cfg.lang}回答学生的问题，术语附英文原词。只依据给出的片段作答；每个要点后面标出出处，格式严格为 [L课次号 mm:ss]，例如 [L3 12:34]。如果片段不足以回答，明确说明哪些部分材料里没有，不要编造老师讲过的内容。`;
    const ans = await llm({ system, parts: [{ text: `【课次列表】\n${cat}\n\n【检索到的片段】\n${ctx}\n\n【问题】${q}` }], smart: true, maxTokens: 3000 });
    box.textContent = '';
    const m = el('div', 'md'); m.innerHTML = md2html(ans);
    box.append(m, el('p', 'hint', lecs.map((l) => `L${l.n} = ${short(l.title || '', 40)}`).join('　')));
  } catch (e) { box.textContent = ''; box.append(el('div', 'err', '出错了：' + e.message)); }
}
$('libSearch').addEventListener('click', libSearch);
$('libAsk').addEventListener('click', libAsk);
$('libList').addEventListener('click', () => { $('libQ').value = ''; libShowList(); });
$('libCourse').addEventListener('change', libShowList);
$('libQ').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); libSearch(); } });

// ---------------------------------------------------------------- tabs / speed / misc UI
function showTab(name) {
  if (name === 'lib') { $('libCourse').value = S.course || $('libCourse').value; libShowList(); }
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('on', v.id === 'v-' + name));
}
$('tabs').addEventListener('click', (e) => { if (e.target.dataset.tab) showTab(e.target.dataset.tab); });
for (const r of [1, 1.25, 1.5, 1.75, 2, 2.5, 3]) {
  const b = el('button', '', r + 'x');
  b.dataset.rate = r;
  b.addEventListener('click', () => cmd({ type: 'll-rate', rate: r }));
  $('speeds').append(b);
}
function markRate() { document.querySelectorAll('#speeds button').forEach((b) => b.classList.toggle('on', +b.dataset.rate === S.rate)); }

$('test').addEventListener('click', async () => {
  $('testOut').textContent = '测试中…';
  try {
    await llm({ system: 'Reply with the single word OK.', parts: [{ text: 'ping' }], maxTokens: 20 });
    let msg = '翻译模型可用';
    if (cfg.smartSep || (cfg.modelSmart && cfg.modelSmart !== cfg.modelFast)) {
      await llm({ system: 'Reply with the single word OK.', parts: [{ text: 'ping' }], maxTokens: 20, smart: true });
      msg = isCodex() ? `翻译模型可用；总结走 Codex · 模型 ${cfg.codexModel === 'default' ? (codexCat.default_model || 'Codex 默认') : cfg.codexModel} · 推理强度 ${cfg.codexEffort === 'default' ? (codexCat.default_effort || 'Codex 默认') : cfg.codexEffort}` : '两个模型都可用';
    }
    $('testOut').textContent = '✓ ' + msg;
  } catch (e) { $('testOut').textContent = '✗ ' + e.message; }
});
$('clearThis').addEventListener('click', async () => {
  if (!S.key) return;
  const k = S.key, t = S.title;
  clearTimeout(saveTimer);
  delete IDX[k];
  await chrome.storage.local.remove(['S:' + k, 'T:' + k]);
  await chrome.storage.local.set({ IDX });
  S.key = null;
  await switchSession(k, t);
});
$('clearAll').addEventListener('click', async () => {
  const all = await chrome.storage.local.get(null);
  clearTimeout(saveTimer);
  IDX = {};
  await chrome.storage.local.remove(Object.keys(all).filter((k) => k.startsWith('S:') || k.startsWith('T:') || k === 'IDX'));
  if (S.key) { const k = S.key, t = S.title; S.key = null; await switchSession(k, t); }
});

// ---------------------------------------------------------------- page link
function cmd(msg) {
  if (S.vTab == null) return Promise.resolve(null);
  const opt = S.frameId != null ? { frameId: S.frameId } : undefined;
  return chrome.tabs.sendMessage(S.vTab, msg, opt).catch(() => null);
}

let switching = Promise.resolve();
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || !sender.tab || sender.tab.id !== S.tabId) return;
  if (msg.type === 'll-tick') {
    const now = Date.now();
    S.frames.set(sender.frameId, { area: msg.area, at: now });
    let best = null, ba = -1;
    for (const [fid, f] of S.frames) if (now - f.at < 3000 && f.area > ba) { ba = f.area; best = fid; }
    if (sender.frameId !== best) return;
    S.vTab = sender.tab.id; S.frameId = sender.frameId;
    switching = switching.then(async () => {
      if (msg.key !== S.key) await switchSession(msg.key, msg.title);
      if (msg.title && msg.title !== S.title) { S.title = msg.title; S.course = courseOf(msg.title, S.key); $('title').textContent = S.title; save(); }
      if (scanning) { S.lastTick = now; S.dur = msg.dur; return; }
      S.t = msg.t; S.dur = msg.dur; S.paused = msg.paused; S.lastTick = now;
      if (S.rate !== msg.rate) { S.rate = msg.rate; markRate(); }
      onTime();
      if (!S.units.length && !S.noCap && S.dur > 0 && now - S.t0 > 8000) { S.noCap = true; buildSegs(); renderSums(); }
      if (now - lastStatus > 1000) { lastStatus = now; status(); }
    });
  } else if (msg.type === 'll-scan') {
    if (!scanning) return;
    if (msg.frame) keepFrame(msg.frame);
    if (msg.total) { scanPct = `${msg.done}/${msg.total}`; scanBtn(); }
    if (msg.finished) {
      scanning = false; scanBtn();
      if (msg.error) $('status').textContent = msg.error === 'tainted' ? '这个网站的视频受保护，无法截取画面，扫描不可用。' : '扫描中断：' + msg.error;
      else if (cfg.apiKey) {
        // summarise what has no notes yet, and redo notes that were written without any screenshot
        S.segs.forEach((seg) => {
          const st = S.sum[seg.i];
          const noShot = st && st.md && !(st.frames && st.frames.length) && scanned.has(seg.i) && (S.fbs[seg.i] || []).length;
          if (!(st && st.md) || (noShot && !msg.stopped)) queueSeg(seg.i, true);
        });
      }
    }
  } else if (msg.type === 'll-cues') {
    pendingCues.set(msg.key, { source: msg.source, cues: msg.cues });
    switching = switching.then(() => { if (msg.key === S.key || (S.key && !S.units.length)) applyCues(msg.source, msg.cues); });
  }
});
let lastStatus = 0;

const injected = new Set();
async function hello() {
  let tab;
  try {
    const fixed = +new URLSearchParams(location.search).get('tab'); // panel.html?tab=<id> pins the panel to one tab
    tab = fixed ? await chrome.tabs.get(fixed) : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  } catch (e) { return; }
  if (!tab || tab.id == null) return;
  if (tab.id !== S.tabId) { S.tabId = tab.id; S.frames.clear(); }
  try { await chrome.tabs.sendMessage(tab.id, { type: 'll-hello' }); }
  catch (e) {
    const k = tab.id + '|' + tab.url;
    if (/Receiving end does not exist/i.test(String(e && e.message)) && /^https?:/.test(tab.url || '') && !injected.has(k)) {
      injected.add(k);
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['hook.js'], world: 'MAIN' });
        await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['parsers.js', 'content.js'] });
      } catch (err) {}
    }
  }
}

(async function init() {
  const st = await chrome.storage.local.get(['cfg', 'IDX', 'codexCat', 'uiLang']);
  setLang(st.uiLang || 'en');
  $('langBtn').addEventListener('click', () => {
    const next = globalThis.LLi18n.lang === 'en' ? 'zh' : 'en';
    chrome.storage.local.set({ uiLang: next });
    setLang(next);
    // re-render everything built from code so it comes out in the new language
    cfgToUi(); status(); renderSums(); renderDeck(); scanBtn(); markRate();
    if ($('v-lib').classList.contains('on')) libShowList();
  });
  cfg = { ...DEF, ...(st.cfg || {}) };
  if (st.codexCat) codexCat = st.codexCat;
  IDX = st.IDX || {};
  cfgToUi(); bindCfg(); renderDeck(); codexRefresh();
  $('codexRefresh').addEventListener('click', codexRefresh);
  hello();
  setInterval(hello, 4000);
  chrome.tabs.onActivated.addListener(hello);
  chrome.tabs.onUpdated.addListener((id, info) => { if (id === S.tabId && info.status === 'complete') hello(); });
})();
