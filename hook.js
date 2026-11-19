// Runs in the page's own JS world. Watches for subtitle/transcript responses the player loads
// and passes them to the content script. Nothing leaves the page from here.
(() => {
  if (window.__llHook) return;
  window.__llHook = true;
  const RE = /transcript|caption|subtitle|timedtext|texttrack|\.vtt|\.srt/i;
  const buf = [];
  const emit = (url, body) => {
    if (typeof body !== 'string' || body.length < 20 || body.length > 8e6) return;
    const m = { __ll: 'cap', url: String(url), body };
    buf.push(m);
    if (buf.length > 8) buf.shift();
    window.postMessage(m, '*');
  };
  window.addEventListener('message', (ev) => {
    if (ev.source === window && ev.data && ev.data.__ll === 'replay') buf.forEach((m) => window.postMessage(m, '*'));
  });

  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (...args) {
      const p = origFetch.apply(this, args);
      try {
        const u = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || String(args[0] || '');
        if (RE.test(u)) {
          p.then((r) => {
            try { r.clone().text().then((t) => emit(u, t)).catch(() => {}); } catch (e) {}
          }).catch(() => {});
        }
      } catch (e) {}
      return p;
    };
  }

  const X = window.XMLHttpRequest;
  if (X && X.prototype) {
    const open = X.prototype.open;
    X.prototype.open = function (method, url) {
      try {
        const u = String(url || '');
        if (RE.test(u)) {
          this.addEventListener('load', () => {
            try {
              if (this.responseType === '' || this.responseType === 'text') emit(u, this.responseText);
              else if (this.responseType === 'json' && this.response) emit(u, JSON.stringify(this.response));
            } catch (e) {}
          });
        }
      } catch (e) {}
      return open.apply(this, arguments);
    };
  }
})();
