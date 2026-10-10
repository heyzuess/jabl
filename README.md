# JABL — OpenEdge ABL Browser IDE

A VS Code–like browser IDE for **OpenEdge ABL** built with Next.js, Monaco, and Tailwind. Open a local folder (File System Access API), edit `.p` / `.w` / `.i` / `.cls` / `.df` / `.abl` files with syntax highlighting and autocomplete, and use a project-scoped terminal (`ls`, `cat`, `pwd`, …) over the opened tree.

## Features

- **Monaco ABL language** — Monarch tokenizer + keyword/snippet/built-in completions
- **Workspace** — `showDirectoryPicker` when available; `<input webkitdirectory>` fallback (save downloads the file)
- **Sample project** — `public/samples/abl/` loads automatically so you can try the IDE immediately
- **Themes** — dark default, light toggle, and a customization panel (persisted in `localStorage`)
- **Terminal** — xterm.js over the virtual workspace only (no OS shell / Progress runtime)

## Requirements

- Node.js 20+
- A Chromium-based browser for full folder open/save; other browsers can use the folder-input fallback and Samples

## Run locally

```bash
npm install
npm run dev -- -p 43127
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

Or production:

```bash
npm run build
npm start -- -p 43127
```

## Out of scope

See [`notes/notes.txt`](notes/notes.txt) under `[future]` — real OpenEdge compiler/runtime, LSP, Electron packaging, and multi-user auth are not part of this slice.
