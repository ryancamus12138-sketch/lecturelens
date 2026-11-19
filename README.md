# LectureLens 课堂助手

看课程录播用的 Chrome 侧边栏：双语字幕、分段笔记、读取画面里的课件和手写、提问、整门课搜索。适配 Echo360，其他带字幕的视频网站也能用。

## 安装

1. 点本页的 **Code → Download ZIP**，解压到一个固定位置。
2. Chrome 打开 `chrome://extensions`，开启右上角的**开发者模式**。
3. 点**加载已解压的扩展程序**，选择解压出来的文件夹。
4. 点工具栏的 LectureLens 图标，打开侧边栏。

界面默认英文，点侧边栏右上角的**中文**切换。

## 配置模型

1. 打开**设置**页。
2. 选接口类型，填接口地址、API key、模型名。例如 DeepSeek：类型选 OpenAI 兼容，地址 `https://api.deepseek.com`。
3. 点**测试连接**，显示 ✓ 即可。

总结和提问需要支持图片的模型，翻译不需要。

## 使用

1. 打开一节录播，点播放。
2. **字幕**页：整节课自动翻译，点任意一句跳转。
3. **总结**页：播放到每段末尾自动出要点；点**扫描整节课**可以不看视频直接总结全部；右侧可导出 PDF / MD / HTML。
4. **提问**页：针对当前这节课提问。
5. **全课**页：搜索或提问所有看过的课。

其他情况：

- 非 Echo360 网站：先打开播放器的 CC 字幕，或在设置页导入 .vtt / .srt。
- 视频没有字幕：几秒后自动改为只根据画面截图总结（没有语音识别）。
- 想对照课件页码：在设置页上传这节课的 .pptx 或 .pdf。

## 用 ChatGPT 会员做总结（可选）

需要已安装 [Codex CLI](https://github.com/openai/codex)。

1. 终端运行 `codex login`，用 ChatGPT 账号登录。
2. 在本文件夹运行 `python3 codex-bridge/bridge.py`，保持窗口开着，复制显示的口令。
3. 设置页勾选**总结 / 答疑改用另一家接口**，类型选**本机 Codex**，粘贴口令，选模型和推理强度。

## 更新

用新文件覆盖同一个文件夹，在 `chrome://extensions` 点扩展卡片上的刷新按钮。不要更换文件夹位置，否则设置和笔记会丢失。

## 说明

- 字幕、上传的课件文字和视频截图只发送给你自己配置的模型服务商。
- 非官方工具，与任何大学、Echo360、OpenAI、DeepSeek 无关联。课程内容的版权归学校或教师所有，请仅用于个人学习并遵守学校和平台的规定。
- 开发过程中使用了 AI 辅助编程。
- 许可：[MIT](LICENSE)，第三方库见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

# LectureLens

English | [简体中文](README.zh-CN.md)

A Chrome side panel for studying from lecture recordings: bilingual captions that keep up at any playback speed, notes for each segment, reading the slides and handwriting on screen, Q&A, and search across a whole course. Built around Echo360; works on other video sites that have captions.

> Unofficial. Not affiliated with any university, Echo360, OpenAI, DeepSeek or Anthropic.

## Install

1. Download this repository (**Code → Download ZIP**) and unzip it somewhere permanent.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and choose the unzipped folder.
4. Click the LectureLens icon in the toolbar to open the side panel.

To update, overwrite the same folder and click the reload button on the extension's card. Moving the folder loses your settings and notes.

## Set up

LectureLens does not include a model. Open **Settings** and enter your own:

| Provider | Enter |
|---|---|
| OpenAI-compatible (DeepSeek, OpenAI, Gemini, Qwen …) | Base URL, API key, model name |
| Anthropic (Claude) | API key, model name |
| Local Codex, experimental | see [below](#notes-through-the-codex-cli-experimental) |

Click **Test connection**. Notes and Q&A need a model that accepts images; translation does not. You can use a cheap model for translation and a different provider for notes.

## Use

| Tab | What it does |
|---|---|
| **Captions** | Open a recording and press play. The whole lecture is translated ahead of playback. Click a sentence to jump to it. |
| **Notes** | Key points appear when playback reaches the end of each segment. **Scan lecture** captures the slides and summarises everything without watching. Export to PDF, Markdown or HTML; timestamps are clickable. |
| **Ask** | Ask about the lecture. Answers use the captions, your slides, the notes and the current frame. |
| **Course** | Every lecture you open is indexed. Search keywords or ask a question across all of them. |
| **Settings** | Models, your slides (.pptx / .pdf), subtitle import (.vtt / .srt), target language, segment length. |

- **Echo360:** the full transcript loads automatically.
- **Other sites:** turn on the player's CC, or import a subtitle file.
- **No captions at all:** after a few seconds Notes switches to screenshots only. There is no speech recognition, so anything the lecturer only says is not captured.
- **Interface language:** English or Chinese; switch with the button at the top of the panel. The language of translations and notes is set separately in Settings.

## Notes through the Codex CLI (experimental)

With a ChatGPT subscription and the [Codex CLI](https://github.com/openai/codex), notes and Q&A can run through Codex on your machine instead of a pay-per-use API.

1. `codex login` with your ChatGPT account.
2. In this folder run `python3 codex-bridge/bridge.py`. Keep the window open and copy the token it prints.
3. In Settings tick **Use a different provider for notes / Q&A**, choose **Local Codex**, paste the token, then pick a model and reasoning effort.

The bridge listens on `127.0.0.1` only, requires the token, and runs one `codex exec` per request in an empty read-only folder. It is slower than an API and uses your Codex allowance. Check that this use fits your subscription's terms.

## Limitations

- The Echo360 transcript is read through an undocumented endpoint and may stop working.
- The extension runs on all sites so it can find captions on any video page. Disable it when not in use.
- Prompts are written in Chinese and tuned for lectures in English with notes in Chinese. Other language pairs are untested.
- Course search is keyword matching, not semantic search.
- Timestamp links only jump in a Chrome that has LectureLens installed.

## Data and disclaimer

- Captions, the text of slides you upload and video frames are sent to the model provider you configure, and nowhere else. No analytics.
- API keys, translations and notes are stored unencrypted in the browser's extension storage.
- Lecture recordings, slides and transcripts usually belong to the university or lecturer. Use this for personal study, follow your institution's and the platform's rules, and do not redistribute course content produced with it.
- Provided as is, without warranty.

AI-assisted programming was used in developing this project.

## Licence

[MIT](LICENSE). Bundled libraries are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
