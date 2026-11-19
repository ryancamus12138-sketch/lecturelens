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
