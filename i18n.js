// UI language layer. The panel's source strings are Chinese; when the UI language is English this
// script rewrites interface text as it appears in the DOM (text nodes, placeholders, tooltips).
// Lecture content (captions, translations, model output, chat) is never touched.
// To add or change a string: put the Chinese source text in EXACT, or a pattern in PATTERNS.
(() => {
  const EXACT = {
    // header / tabs
    '打开一个课程录播页面，然后播放视频。': 'Open a lecture recording and start the video.',
    '字幕': 'Captions', '总结': 'Notes', '提问': 'Ask', '全课': 'Course', '设置': 'Settings',
    // captions tab
    '跟随播放': 'Follow playback', '显示原文': 'Show original', '重试翻译': 'Retry translation',
    '还没有拿到字幕。Echo360 会自动读取完整转录；其他网站请打开播放器的 CC，或在“设置”里导入 .vtt / .srt 字幕文件。视频确实没有字幕时，“总结”页会改为只根据画面截图生成笔记。':
      'No captions yet. On Echo360 the full transcript is loaded automatically; on other sites turn on the player\'s CC, or import a .vtt / .srt file in Settings. If the video really has no captions, the Notes tab falls back to writing notes from screenshots alone.',
    // notes tab
    '扫描整节课': 'Scan lecture', '总结全部': 'Summarise all', '整课笔记': 'Lecture notes', '生成整课笔记': 'Lecture notes',
    '不用播放：自动跳着截取整节课每一页 PPT 的画面，然后总结全部分段': 'No need to watch: jumps through the lecture, grabs the slides on screen, then summarises every segment',
    '只根据字幕和已截到的画面总结，不扫描': 'Summarise from captions and screenshots already captured, without scanning',
    '播放到每个分段末尾时会自动生成要点。不想等：点“扫描整节课”，自动截取每页 PPT 的画面并总结全部分段。':
      'Key points are generated automatically when playback reaches the end of each segment. To skip the wait, click “Scan lecture”: it captures the slides and summarises every segment.',
    '生成中…': 'Generating…', '重新生成': 'Regenerate', '总结这一段': 'Summarise this segment',
    // ask tab
    '针对这节课随时提问，回答会结合字幕、课件和已有总结。例如：“刚才这个公式是怎么推出来的？”':
      'Ask anything about this lecture. Answers draw on the captions, your slides and the notes so far. For example: “How was that last formula derived?”',
    '输入问题，Enter 发送，Shift+Enter 换行': 'Type a question. Enter to send, Shift+Enter for a new line',
    '附带当前画面': 'Attach current frame', '清空': 'Clear', '发送': 'Send',
    // course tab
    '搜索关键词（中英文都行），或直接向整门课提问': 'Search keywords, or ask a question across the whole course',
    '搜索': 'Search', '问整门课': 'Ask the course', '已收录课次': 'Indexed lectures', '笔记': 'Notes',
    '还没有收录任何课次。每打开并加载过字幕的一节录播，都会自动收进这里（按课程代码归类）；之后就能跨课次搜索和提问。升级到这个版本之前看过的课，需要重新打开一次才会收录。':
      'No lectures indexed yet. Every recording you open with captions loaded is added here automatically (grouped by course code), so you can search and ask across lectures. Lectures watched before this version need to be opened once more to be indexed.',
    '搜索范围是字幕原文、译文和已生成的笔记。没翻译/没总结过的课只能用英文关键词搜到。':
      'Search covers the original captions, their translations and generated notes. Lectures that have not been translated or summarised only match keywords in the lecture\'s own language.',
    '在已收录的课次里没有检索到相关内容。可能这部分内容所在的课还没打开过。':
      'Nothing relevant was found in the indexed lectures. The lecture covering this may not have been opened yet.',
    // settings: files
    '课件 / 字幕文件': 'Slides / subtitle files',
    '上传这节课的 PPT（.pptx / .pdf）或讲义文本，总结和答疑会对照课件页码。也可以导入 .vtt / .srt 字幕。':
      'Upload this lecture\'s slides (.pptx / .pdf) or notes; summaries and answers will refer to slide numbers. You can also import .vtt / .srt subtitles.',
    '尚未上传课件。': 'No slides uploaded yet.',
    // settings: model endpoints
    '模型接口': 'Model endpoint', '接口类型': 'Provider',
    'OpenAI 兼容（OpenAI / DeepSeek / Gemini / 通义等）': 'OpenAI-compatible (OpenAI / DeepSeek / Gemini / Qwen …)',
    '接口地址 (Base URL)': 'Base URL', '只保存在本机浏览器': 'Stored only in this browser',
    '翻译用模型（快、便宜）': 'Translation model (fast, cheap)',
    '总结 / 答疑用模型（更强，需支持图片才能读画面；留空则同上）': 'Notes / Q&A model (stronger; needs image input to read the screen; blank = same as above)',
    '总结 / 答疑改用另一家接口（例如翻译用 DeepSeek，总结用 GPT）': 'Use a different provider for notes / Q&A (e.g. DeepSeek for translation, GPT for notes)',
    '总结接口类型': 'Notes provider',
    '本机 Codex（用 ChatGPT 会员额度，需先运行 codex-bridge）': 'Local Codex (uses your ChatGPT plan; run codex-bridge first)',
    'OpenAI 兼容（OpenAI / Gemini 等，按量付费）': 'OpenAI-compatible (OpenAI / Gemini …, pay per use)',
    '总结接口地址 (Base URL)': 'Notes endpoint Base URL', '总结接口的 API key': 'Notes endpoint API key',
    '桥接口令（终端里显示的 ll-… 那串）': 'Bridge token (the ll-… string shown in the terminal)',
    'Codex 模型': 'Codex model', '推理强度（越高越细致，也越慢、越耗额度）': 'Reasoning effort (higher = more thorough, slower, uses more of your plan)',
    '刷新模型列表': 'Refresh model list', '测试连接': 'Test connection', '测试中…': 'Testing…', '读取中…': 'Loading…',
    '跟随 Codex 配置': 'Use Codex config', 'minimal（最快）': 'minimal (fastest)', 'low（快）': 'low (fast)', 'medium（均衡）': 'medium (balanced)',
    'high（细致）': 'high (thorough)', 'xhigh（最细致，最慢）': 'xhigh (most thorough, slowest)',
    '先填口令（启动 bridge.py 时终端里显示的 ll-… 那串）': 'Enter the token first (the ll-… string printed when bridge.py starts)',
    '已连上，但没读到模型列表：可以先用“跟随 Codex 配置”': 'Connected, but no model list was returned: use “Use Codex config” for now',
    '连不上本机桥接：请先在终端运行 python3 codex-bridge/bridge.py': 'Cannot reach the local bridge: run python3 codex-bridge/bridge.py in a terminal first',
    // settings: behaviour
    '行为': 'Behaviour', '翻译目标语言': 'Translate into', '总结分段长度（分钟，按视频时间）': 'Notes segment length (minutes of video time)',
    '视频上叠加字幕': 'Captions over the video', '译文 + 原文': 'Translation + original', '仅译文': 'Translation only', '关闭': 'Off',
    '扫描整节课时每个分段截几张画面（越少越快）': 'Screenshots per segment when scanning (fewer = faster)',
    '1 张（最快）': '1 (fastest)', '2 张（推荐）': '2 (recommended)', '3 张（最细）': '3 (most detail)',
    '自动翻译整节课字幕（提前翻好，倍速不掉队）': 'Translate the whole lecture ahead of playback (keeps up at any speed)',
    '播放到分段末尾自动总结': 'Summarise each segment when playback reaches its end',
    '截取视频画面给模型（读 PPT、板书和手写标注）': 'Send video frames to the model (to read slides, the board and handwritten notes)',
    '缓存': 'Cache', '清除本节课缓存': 'Clear this lecture', '清除全部缓存': 'Clear everything',
    // banner / status
    '还没有填 API key：字幕原文可以同步显示，但翻译、总结和提问需要先在“设置”里配置模型接口。':
      'No API key yet: original captions still sync with playback, but translation, notes and Q&A need a model endpoint configured in Settings.',
    '还没有可导出的笔记，先生成总结。': 'Nothing to export yet. Generate some notes first.',
    '先打开录播并让视频加载出来，再扫描。': 'Open a recording and let the video load before scanning.',
    '设置里关闭了“截取视频画面”，扫描没有意义；可直接点“总结全部”。': '“Send video frames” is off in Settings, so scanning would do nothing; use “Summarise all” instead.',
    '每个分段都已经有截图了，不需要再扫描。': 'Every segment already has screenshots; no scan needed.',
    '无法开始扫描，刷新录播页面后再试。': 'Could not start scanning. Reload the recording page and try again.',
    '这个网站的视频受保护，无法截取画面，扫描不可用。': 'This site protects its video, so frames cannot be captured and scanning is unavailable.',
  };

  // Messages that appear inside longer strings (after a prefix, inside an error, …).
  const PHRASES = {
    '未配置 API key': 'No API key configured',
    '已勾选“总结改用另一家接口”，但还没填它的 API key': '“Use a different provider for notes” is ticked but its API key is empty',
    '请填写“总结 / 答疑用模型”的名称': 'Fill in the “Notes / Q&A model” name',
    '未填写模型名称': 'No model name set',
    '连不上本机 Codex 桥接：请确认终端里的 python3 codex-bridge/bridge.py 还在运行': 'Cannot reach the local Codex bridge: make sure python3 codex-bridge/bridge.py is still running in a terminal',
    '模型返回为空': 'The model returned nothing',
    '分段总结都没有生成成功，请先检查接口设置': 'No segment notes could be generated; check the endpoint settings first',
    '没有解析出字幕': 'No cues could be parsed from the file',
    '请先打开并播放视频，再导入字幕': 'Open and play the video before importing subtitles',
    '没有提取到文字（可能是扫描版/纯图片课件）。这种情况可以依靠“截取视频画面”来读课件': 'No text could be extracted (probably scanned or image-only slides). In that case rely on “Send video frames” to read the slides',
    '翻译模型可用': 'Translation model OK', '两个模型都可用': 'Both models OK', 'Codex 默认': 'Codex default',
    '等待字幕…': 'Waiting for captions…', '没有字幕，仅根据画面总结': 'No captions: notes from screenshots only',
    '这一段既没有字幕也没有截图：先播放这一段，或点“扫描整节课”。': 'This segment has neither captions nor screenshots: play it first, or click “Scan lecture”.',
    '这个视频没有字幕，只能靠画面总结：请先在设置里打开“截取视频画面”。': 'This video has no captions, so notes can only come from the screen: turn on “Send video frames” in Settings first.',
    '这个视频没有字幕，只能靠画面总结，但当前模型没能读取截图（需要支持图片输入的模型）：': 'This video has no captions, so notes can only come from the screen, but the current model could not read the screenshots (a model with image input is needed): ', 'Echo360 转录': 'Echo360 transcript', '播放器字幕': 'Player captions',
    '导入的字幕文件': 'Imported subtitle file',
  };

  const PATTERNS = [
    [/字幕轨 /g, 'Caption track '],
    [/ · (\d+) 句/, ' · $1 sentences'],
    [/ · 已翻译 (\d+)%/, ' · $1% translated'],
    [/（当前 ([^）]+)）/, ' (currently $1)'],
    [/（该模型默认 ([^）]+)）/, ' (model default: $1)'],
    [/^读到 (\d+) 个可用模型$/, 'Found $1 available models'],
    [/^读取失败：/, 'Failed to load: '],
    [/ 读取失败：/, ' could not be read: '],
    [/翻译出错：/, 'Translation error: '],
    [/接口返回 (\d+)：/, 'API returned $1: '],
    [/网络错误：/, 'Network error: '],
    [/整课笔记生成失败：/, 'Could not generate lecture notes: '],
    [/扫描中断：/, 'Scan interrupted: '],
    [/出错了：/, 'Error: '],
    [/；总结走 Codex · 模型 (.+) · 推理强度 (.+)$/, '; notes via Codex · model $1 · reasoning effort $2'],
    [/^（当前模型未能读取截图，本段仅根据字幕生成：(.*)）$/, '(The model could not read the screenshots, so this segment was written from captions only: $1)'],
    [/^已载入课件：(.*)（(\d+) 页，(\d+) 字符）$/, 'Slides loaded: $1 ($2 pages, $3 characters)'],
    [/^已导入字幕 (.*)（(\d+) 条）$/, 'Subtitles imported: $1 ($2 cues)'],
    [/^扫描中 (\S*)（点击停止）$/, 'Scanning $1 (click to stop)'],
    [/^已收录 (\d+) 节$/, '$1 indexed'],
    [/ · 笔记 (\d+) 段$/, ' · $1 note segments'],
    [/^在 (\d+) 节课里没有找到“(.*)”。字幕是英文的：没翻译过的课请换英文关键词，或用“问整门课”。$/, 'Nothing found for “$2” in $1 lecture(s). For lectures that have not been translated, try keywords in the lecture\'s own language, or use “Ask the course”.'],
    [/^(\d+) 处匹配（按相关度排序），点时间跳转：$/, '$1 matches, most relevant first. Click a time to jump:'],
    [/^正在 (\d+) 节课里查找…$/, 'Searching $1 lecture(s)…'],
  ];

  const CJK = /[一-鿿]/;
  const SKIP = '#subs .zh, #subs .en, .md, .msg, #title, .hit > div:not(.where), .lec .t, script, style';
  const ATTRS = ['placeholder', 'title'];
  let lang = 'zh';
  const origText = new WeakMap(), origAttr = new WeakMap();

  function toEn(s) {
    if (!CJK.test(s)) return s;
    const core = s.trim();
    if (Object.prototype.hasOwnProperty.call(EXACT, core)) return s.replace(core, () => EXACT[core]);
    let out = s;
    for (const k in PHRASES) if (out.includes(k)) out = out.split(k).join(PHRASES[k]);
    for (const [re, rep] of PATTERNS) out = out.replace(re, rep);
    return out;
  }
  const skipped = (node) => { const e = node.nodeType === 1 ? node : node.parentElement; return !e || !!e.closest(SKIP); };

  function doText(node) {
    if (lang !== 'en' || skipped(node)) return;
    const zh = node.nodeValue, en = toEn(zh);
    if (en !== zh) { origText.set(node, { zh, en }); node.nodeValue = en; }
  }
  function doAttrs(el) {
    if (lang !== 'en' || skipped(el)) return;
    for (const a of ATTRS) {
      const zh = el.getAttribute(a);
      if (!zh) continue;
      const en = toEn(zh);
      if (en !== zh) { const m = origAttr.get(el) || {}; m[a] = { zh, en }; origAttr.set(el, m); el.setAttribute(a, en); }
    }
  }
  function walk(root, restore) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    const visit = (n) => {
      if (n.nodeType === 3) {
        if (!restore) doText(n);
        else { const o = origText.get(n); if (o && n.nodeValue === o.en) n.nodeValue = o.zh; }
      } else if (n.nodeType === 1) {
        if (!restore) doAttrs(n);
        else { const m = origAttr.get(n); if (m) for (const a in m) if (n.getAttribute(a) === m[a].en) n.setAttribute(a, m[a].zh); }
      }
    };
    visit(root);
    while (w.nextNode()) visit(w.currentNode);
  }

  new MutationObserver((muts) => {
    if (lang !== 'en') return;
    for (const m of muts) {
      if (m.type === 'characterData') doText(m.target);
      else if (m.type === 'attributes') doAttrs(m.target);
      else m.addedNodes.forEach((n) => { if (n.nodeType === 3) doText(n); else if (n.nodeType === 1) walk(n, false); });
    }
  }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });

  globalThis.LLi18n = {
    get lang() { return lang; },
    set(l) {
      l = l === 'zh' ? 'zh' : 'en';
      if (l === lang) return;
      if (l === 'zh') { lang = 'zh'; walk(document.documentElement, true); }
      else { lang = 'en'; walk(document.documentElement, false); }
      document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
    },
    text(s) { return lang === 'en' ? toEn(s) : s; },
  };
  globalThis.LLi18n.set('en'); // English by default; the panel switches to the saved choice once settings load
})();
