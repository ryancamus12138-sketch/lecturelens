// Runs in every frame. Finds the lecture video and its captions, reports playback position to the
// side panel, and carries out the panel's commands (seek, speed, overlay, frame capture).
(() => {
  if (window.__llContent) return;
  window.__llContent = true;
  const { parseAny, clean } = globalThis.LLParse;

  const send = (m) => { try { chrome.runtime.sendMessage(m).catch(() => {}); } catch (e) {} };
  let lastHello = 0;
  const active = () => Date.now() - lastHello < 12000;

  const pageKey = () => {
    let k = location.origin + location.pathname;
    try { const v = new URLSearchParams(location.search).get('v'); if (v) k += '?v=' + v; } catch (e) {}
    return k;
  };

  // ---------- video ----------
  const videos = () => [...document.querySelectorAll('video')];
  const area = (v) => v.clientWidth * v.clientHeight;
  function primary() {
    const vs = videos().filter((v) => v.readyState > 0 || v.currentSrc || v.src);
    if (!vs.length) return null;
    vs.sort((a, b) => area(b) - area(a));
    return vs[0];
  }

  // ---------- captions ----------
  const sets = new Map(); // source -> cues
  let sentSig = '';
  const weight = (src, cues) => cues.reduce((n, c) => n + c.t.length, 0) * (src === 'Echo360 转录' ? 4 : 1);
  function addSet(src, cues) {
    if (!cues || cues.length < 3) return;
    const old = sets.get(src);
    if (old && old.length >= cues.length) return;
    sets.set(src, cues);
    pushCues(false);
  }
  function pushCues(force) {
    let best = null, bw = 0;
    for (const [src, cues] of sets) { const w = weight(src, cues); if (w > bw) { bw = w; best = [src, cues]; } }
    if (!best) return;
    const sig = best[0] + ':' + best[1].length;
    if (!force && sig === sentSig) return;
    sentSig = sig;
    send({ type: 'll-cues', key: pageKey(), title: document.title, source: best[0], cues: best[1] });
  }

  // 1) whatever the player itself downloads (via hook.js)
  const mediaIds = new Set();
  window.addEventListener('message', (ev) => {
    if (ev.source !== window || !ev.data || ev.data.__ll !== 'cap') return;
    const m = String(ev.data.url).match(/\/medias\/([0-9a-f-]{36})/i);
    if (m) mediaIds.add(m[1]);
    addSet('播放器字幕', parseAny(ev.data.body));
  });

  // 2) <track> / HLS text tracks
  function pollTracks() {
    for (const v of videos()) {
      for (const tr of v.textTracks || []) {
        if (tr.kind && !/subtitles|captions/.test(tr.kind)) continue;
        try {
          if (tr.mode === 'disabled') tr.mode = 'hidden';
          const cs = tr.cues;
          if (!cs || cs.length < 3) continue;
          const cues = [];
          for (const c of cs) { const t = clean(c.text || ''); if (t) cues.push({ s: c.startTime, e: c.endTime, t }); }
          addSet('字幕轨 ' + (tr.label || tr.language || ''), cues);
        } catch (e) {}
      }
    }
  }

  // 3) Echo360: ask its API for the full transcript directly
  let echoTries = 0, echoDone = false, echoBusy = false;
  async function tryEcho() {
    if (echoDone || echoBusy || echoTries > 8 || !/echo360/i.test(location.hostname)) return;
    const lm = location.pathname.match(/\/lesson\/([^/]+)/);
    if (!lm) return;
    echoBusy = true; echoTries++;
    try {
      const lessonId = decodeURIComponent(lm[1]);
      try {
        for (const e of performance.getEntriesByType('resource')) {
          const m = e.name.match(/\/medias\/([0-9a-f-]{36})/i);
          if (m) mediaIds.add(m[1]);
        }
      } catch (e) {}
      if (!mediaIds.size && lessonId.startsWith('G_')) {
        const sectionId = lessonId.split('_')[2];
        const j = await (await fetch(`/section/${sectionId}/syllabus`, { credentials: 'include' })).json();
        const walk = (o, d) => {
          if (!o || typeof o !== 'object' || d > 8) return;
          if (o.lesson && o.lesson.lesson && o.lesson.lesson.id === lessonId) (o.lesson.medias || []).forEach((x) => x.id && mediaIds.add(x.id));
          for (const k in o) walk(o[k], d + 1);
        };
        walk(j, 0);
      }
      for (const mid of mediaIds) {
        const r = await fetch(`/api/ui/echoplayer/lessons/${lessonId}/medias/${mid}/transcript`, { credentials: 'include' });
        if (!r.ok) continue;
        const cues = parseAny(await r.text());
        if (cues.length >= 3) { addSet('Echo360 转录', cues); echoDone = true; }
      }
    } catch (e) {}
    echoBusy = false;
  }

  // ---------- overlay ----------
  const ov = { mode: 'off', en: '', zh: '', el: null };
  function drawOverlay() {
    const v = primary();
    const show = ov.mode !== 'off' && v && (ov.zh || ov.en);
    if (!show) { if (ov.el) ov.el.style.display = 'none'; return; }
    if (!ov.el) {
      const el = document.createElement('div');
      el.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;text-align:center;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;line-height:1.35;';
      const zh = document.createElement('div'), en = document.createElement('div');
      const box = 'display:inline-block;background:rgba(0,0,0,.72);color:#fff;padding:.15em .55em;border-radius:6px;margin-top:3px;max-width:100%;box-sizing:border-box;';
      zh.style.cssText = box; en.style.cssText = box + 'font-size:.72em;color:#d6d6d6;';
      const w1 = document.createElement('div'), w2 = document.createElement('div');
      w1.appendChild(zh); w2.appendChild(en); el.append(w1, w2);
      ov.el = el; ov.zhEl = zh; ov.enEl = en; ov.enWrap = w2; ov.zhWrap = w1;
    }
    const host = document.fullscreenElement || document.documentElement;
    if (ov.el.parentNode !== host) host.appendChild(ov.el);
    const r = v.getBoundingClientRect();
    const s = ov.el.style;
    s.display = 'block';
    s.left = (r.left + r.width * 0.05) + 'px';
    s.width = (r.width * 0.9) + 'px';
    s.bottom = Math.max(6, window.innerHeight - r.bottom + r.height * 0.1) + 'px';
    s.fontSize = Math.max(13, Math.min(26, r.width / 40)) + 'px';
    ov.zhEl.textContent = ov.zh || ov.en;
    ov.zhWrap.style.display = '';
    ov.enEl.textContent = ov.en;
    ov.enWrap.style.display = ov.mode === 'both' && ov.zh && ov.en ? '' : 'none';
  }
  document.addEventListener('fullscreenchange', drawOverlay);
  window.addEventListener('resize', drawOverlay);

  // ---------- frame capture ----------
  function capture() {
    const vs = videos().filter((v) => v.videoWidth > 0 && v.clientWidth > 150).sort((a, b) => area(b) - area(a)).slice(0, 2);
    if (!vs.length) return { error: 'novideo' };
    try {
      const images = [], sigs = [];
      for (const v of vs) {
        const sc = Math.min(1, 1280 / v.videoWidth);
        const c = document.createElement('canvas');
        c.width = Math.round(v.videoWidth * sc); c.height = Math.round(v.videoHeight * sc);
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
        images.push(c.toDataURL('image/jpeg', 0.72));
        const t = document.createElement('canvas');
        t.width = 24; t.height = 14;
        const tc = t.getContext('2d');
        tc.drawImage(v, 0, 0, 24, 14);
        const d = tc.getImageData(0, 0, 24, 14).data, g = [];
        for (let i = 0; i < d.length; i += 4) g.push(Math.round(d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11));
        sigs.push(g);
      }
      return { images, sigs, t: vs[0].currentTime };
    } catch (e) {
      return { error: 'tainted' };
    }
  }

  // ---------- whole-lecture scan ----------
  function sigChanged(a, b) {
    if (!a || !b || a.length !== b.length) return true;
    for (let k = 0; k < a.length; k++) {
      let d = 0;
      for (let i = 0; i < a[k].length; i++) d += Math.abs(a[k][i] - b[k][i]);
      if (d / a[k].length > 9) return true;
    }
    return false;
  }
  function seekAll(vs, t) {
    return Promise.all(vs.map((x) => new Promise((res) => {
      let done = false;
      const fin = () => { if (done) return; done = true; x.removeEventListener('seeked', fin); res(); };
      x.addEventListener('seeked', fin);
      setTimeout(fin, 4000);
      try { x.currentTime = Math.min(t, (x.duration || t + 1) - 0.3); } catch (e) { fin(); }
    }))).then(async () => {
      for (let i = 0; i < 30 && vs.some((x) => x.readyState < 2); i++) await new Promise((r) => setTimeout(r, 100));
    });
  }
  let scan = null;
  async function runScan(times, groups) {
    const v = primary();
    if (!v || scan) return;
    const vs = videos().filter((x) => x === v || Math.abs((x.duration || 0) - v.duration) < 3);
    const keep = { t: v.currentTime, paused: v.paused };
    scan = { stop: false };
    vs.forEach((x) => { try { x.pause(); } catch (e) {} });
    const total = times.length;
    let prev = null, n = 0, err = '';
    for (let k = 0; k < times.length; k++) {
      const t = times[k];
      if (scan.stop) break;
      await seekAll(vs, t);
      const f = capture();
      if (f.error) { err = f.error; break; }
      f.t = t;
      // Within one segment, skip shots that look the same as the previous one. The first shot of
      // every segment is always kept, even if the slide has not changed since the last segment.
      const newGroup = !groups || k === 0 || groups[k] !== groups[k - 1];
      if (!prev || newGroup || sigChanged(prev.sigs, f.sigs)) send({ type: 'll-scan', frame: { t, images: f.images } });
      prev = f; n++;
      send({ type: 'll-scan', done: n, total });
    }
    await seekAll(vs, keep.t);
    if (!keep.paused) { try { await v.play(); } catch (e) {} }
    const stopped = scan.stop;
    scan = null;
    send({ type: 'll-scan', finished: true, stopped, error: err });
  }

  // ---------- "#ll-t=seconds" links (from exported notes / course search) ----------
  const hm = location.hash.match(/ll-t=(\d+(?:\.\d+)?)/);
  if (hm) {
    const target = +hm[1];
    let tries = 0, again = false;
    const go = () => { for (const x of videos()) { try { x.currentTime = target; } catch (e) {} } };
    const iv = setInterval(() => {
      const v = primary();
      if (v && v.readyState >= 1 && isFinite(v.duration)) {
        if (!again) { go(); again = true; tries = 0; return; }
        if (tries++ >= 4) { if (Math.abs(v.currentTime - target) > 20 && v.currentTime < target) go(); clearInterval(iv); }
      } else if (++tries > 120) clearInterval(iv);
    }, 500);
  }

  // ---------- panel messages ----------
  chrome.runtime.onMessage.addListener((msg, _s, reply) => {
    if (!msg || typeof msg.type !== 'string') return;
    if (msg.type === 'll-hello') {
      lastHello = Date.now();
      window.postMessage({ __ll: 'replay' }, '*');
      pollTracks(); tryEcho(); pushCues(true); tick(true);
      reply({ ok: true, hasVideo: !!primary() });
      return;
    }
    const v = primary();
    if (!v) return;
    if (msg.type === 'll-seek') {
      const d = v.duration;
      for (const x of videos()) if (x === v || Math.abs((x.duration || 0) - d) < 3) { try { x.currentTime = msg.t; } catch (e) {} }
      reply({ ok: true });
    } else if (msg.type === 'll-rate') {
      for (const x of videos()) { try { x.playbackRate = msg.rate; } catch (e) {} }
      reply({ ok: true });
    } else if (msg.type === 'll-overlay') {
      ov.mode = msg.mode; ov.en = msg.en || ''; ov.zh = msg.zh || '';
      drawOverlay();
      reply({ ok: true });
    } else if (msg.type === 'll-capture') {
      reply(capture());
    } else if (msg.type === 'll-scan-start') {
      if (scan) { reply({ ok: false }); return; }
      runScan(msg.times, msg.groups);
      reply({ ok: true });
    } else if (msg.type === 'll-scan-stop') {
      if (scan) scan.stop = true;
      reply({ ok: true });
    }
  });

  // ---------- heartbeat ----------
  function tick(force) {
    if (!force && !active()) { if (ov.el) ov.el.style.display = 'none'; return; }
    const v = primary();
    if (!v) return;
    send({
      type: 'll-tick', key: pageKey(), title: document.title, t: v.currentTime, dur: isFinite(v.duration) ? v.duration : 0,
      paused: v.paused, rate: v.playbackRate, area: area(v) * (window === window.top ? 1 : 1.0001),
    });
  }
  setInterval(() => tick(false), 250);
  setInterval(() => { if (active()) { pollTracks(); tryEcho(); } }, 2500);
})();
