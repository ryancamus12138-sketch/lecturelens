(async () => {
  const { EXPORT } = await chrome.storage.local.get('EXPORT');
  if (!EXPORT) { document.getElementById('doc').textContent = 'Nothing to export. Go back to the side panel and click PDF again. / 没有可导出的内容，请回到侧边栏重新点 PDF。'; return; }
  document.title = EXPORT.title;
  if (EXPORT.lang === 'zh') {
    document.documentElement.lang = 'zh-CN';
    document.getElementById('tipText').innerHTML = '在打印窗口的“目标打印机”里选 <b>另存为 PDF</b>。PDF 里的时间戳可点击，会跳回录播的对应位置（需要在装了 LectureLens 的 Chrome 里打开）。';
    document.getElementById('again').textContent = '打印 / 存为 PDF';
  } else document.documentElement.lang = 'en';
  document.getElementById('doc').innerHTML = EXPORT.body; // built by the panel from escaped Markdown
  await Promise.all([...document.images].map((im) => (im.decode ? im.decode().catch(() => {}) : null)));
  document.getElementById('again').addEventListener('click', () => window.print());
  if (!new URLSearchParams(location.search).has('noprint')) setTimeout(() => window.print(), 300);
})();
