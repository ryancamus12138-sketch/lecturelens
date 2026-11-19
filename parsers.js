// Subtitle parsing shared by the content script and the side panel.
(() => {
  const toSec = (s) => {
    const m = String(s).trim().replace(',', '.').match(/(?:(\d+):)?(\d{1,2}):(\d{2}(?:\.\d+)?)/);
    if (!m) return NaN;
    return (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + parseFloat(m[3]);
  };
  const clean = (t) => String(t)
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim();

  function parseTimed(text) {
    const out = [];
    for (const b of text.replace(/\r/g, '').split(/\n{2,}/)) {
      const lines = b.split('\n');
      const i = lines.findIndex((l) => l.includes('-->'));
      if (i < 0) continue;
      const [a, z] = lines[i].split('-->');
      const s = toSec(a), e = toSec(z);
      const t = clean(lines.slice(i + 1).join(' '));
      if (isFinite(s) && t) out.push({ s, e: isFinite(e) ? e : s + 3, t });
    }
    return out;
  }

  function parseXml(text) {
    const out = [];
    const re = /<(text|p)\b([^>]*)>([\s\S]*?)<\/\1>/g;
    let m;
    const attr = (a, k) => { const x = a.match(new RegExp('\\b' + k + '="([^"]*)"')); return x ? x[1] : null; };
    const tv = (v) => v == null ? NaN : (v.includes(':') ? toSec(v) : (/ms$/.test(v) ? parseFloat(v) / 1000 : parseFloat(v)));
    while ((m = re.exec(text))) {
      const a = m[2];
      let s = tv(attr(a, 'start') ?? attr(a, 'begin') ?? attr(a, 't'));
      if (attr(a, 't') != null && attr(a, 'start') == null && attr(a, 'begin') == null) s = parseFloat(attr(a, 't')) / 1000;
      let e = tv(attr(a, 'end'));
      const d = attr(a, 'dur') ?? attr(a, 'd');
      if (!isFinite(e) && d != null) e = s + (attr(a, 'd') != null && attr(a, 'dur') == null ? parseFloat(d) / 1000 : tv(d));
      const t = clean(m[3]);
      if (isFinite(s) && t) out.push({ s, e: isFinite(e) ? e : s + 3, t });
    }
    return out;
  }

  const MS_S = ['startMs', 'start_ms', 'tStartMs', 'startTimeMs', 'beginMs'];
  const SEC_S = ['start', 'startTime', 'start_time', 'begin', 'from', 'offset', 'ts', 'time'];
  const MS_E = ['endMs', 'end_ms', 'endTimeMs'];
  const SEC_E = ['end', 'endTime', 'end_time', 'to'];
  const num = (v) => typeof v === 'number' ? v : (typeof v === 'string' ? (v.includes(':') ? toSec(v) : parseFloat(v)) : NaN);

  function cueFromObj(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    let t = o.content ?? o.text ?? o.caption ?? o.utf8 ?? o.line ?? o.transcript ?? o.sentence;
    if (Array.isArray(o.segs)) t = o.segs.map((x) => (x && x.utf8) || '').join('');
    if (typeof t !== 'string') return null;
    let s = NaN, e = NaN, ms = false;
    for (const k of MS_S) if (k in o && isFinite(num(o[k]))) { s = num(o[k]) / 1000; ms = true; break; }
    if (!isFinite(s)) for (const k of SEC_S) if (k in o && isFinite(num(o[k]))) { s = num(o[k]); break; }
    if (!isFinite(s)) return null;
    for (const k of MS_E) if (k in o && isFinite(num(o[k]))) { e = num(o[k]) / 1000; break; }
    if (!isFinite(e)) for (const k of SEC_E) if (k in o && isFinite(num(o[k]))) { e = num(o[k]); break; }
    if (!isFinite(e) && isFinite(num(o.dDurationMs))) e = s + num(o.dDurationMs) / 1000;
    if (!isFinite(e) && isFinite(num(o.durationMs))) e = s + num(o.durationMs) / 1000;
    if (!isFinite(e)) { const d = num(o.duration ?? o.dur); if (isFinite(d)) e = s + (ms ? d / 1000 : d); }
    t = clean(t);
    if (!t) return null;
    return { s, e: isFinite(e) ? e : s + 3, t, _ms: ms };
  }

  function findCues(node, depth = 0) {
    let best = [];
    if (!node || typeof node !== 'object' || depth > 7) return best;
    if (Array.isArray(node)) {
      const c = node.map(cueFromObj).filter(Boolean);
      if (c.length >= 3 && c.length >= node.length * 0.5) best = c;
      for (const x of node.slice(0, 50)) { const r = findCues(x, depth + 1); if (r.length > best.length) best = r; }
    } else {
      for (const k in node) { const r = findCues(node[k], depth + 1); if (r.length > best.length) best = r; }
    }
    return best;
  }

  function parseAny(body) {
    if (typeof body !== 'string') return [];
    const b = body.trim();
    let cues = [];
    try {
      if (b[0] === '{' || b[0] === '[') {
        cues = findCues(JSON.parse(b));
        // second-valued keys that actually hold milliseconds
        if (cues.length && !cues[0]._ms && cues.every((c) => Number.isInteger(c.s)) && cues[cues.length - 1].s > 40000) {
          cues.forEach((c) => { c.s /= 1000; c.e /= 1000; });
        }
        cues.forEach((c) => delete c._ms);
      } else if (b.includes('-->')) cues = parseTimed(b);
      else if (b[0] === '<') cues = parseXml(b);
    } catch (e) { cues = []; }
    cues.sort((x, y) => x.s - y.s);
    const out = [];
    for (const c of cues) {
      const p = out[out.length - 1];
      if (p && p.t === c.t) { p.e = Math.max(p.e, c.e); continue; }
      if (c.e <= c.s) c.e = c.s + 2;
      out.push(c);
    }
    return out;
  }

  // Join caption fragments into sentence-sized units so translation has enough context.
  function mergeCues(cues) {
    const out = [];
    let cur = null;
    for (const c of cues) {
      if (!c.t) continue;
      if (cur && (c.s - cur.e > 2.5 || cur.t.length + c.t.length > 260 || c.e - cur.s > 18)) { out.push(cur); cur = null; }
      if (!cur) cur = { s: c.s, e: c.e, t: c.t };
      else { cur.e = c.e; cur.t += ' ' + c.t; }
      if (/[.?!。？！]["')\]]?$/.test(cur.t) && cur.t.length > 40) { out.push(cur); cur = null; }
    }
    if (cur) out.push(cur);
    return out;
  }

  globalThis.LLParse = { parseAny, mergeCues, clean, toSec };
})();
