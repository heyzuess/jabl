# JABL — OpenEdge ABL Browser IDE

A VS Code–like browser IDE for **OpenEdge ABL** built with Next.js, Monaco, and Tailwind. Open a local folder (File System Access API), edit `.p` / `.w` / `.i` / `.cls` / `.df` / `.abl` files with syntax highlighting and autocomplete, and use a project-scoped terminal (`ls`, `cat`, `pwd`, …) over the opened tree.

## Features

- **Monaco ABL language** — Monarch tokenizer + keyword/snippet/built-in completions
- **New File** — create an unsaved tab from Blank, Procedure, Class, or Include templates; Save writes locally (`showSaveFilePicker` or download)
- **Workspace** — `showDirectoryPicker` when available; `<input webkitdirectory>` fallback (save downloads the file)
- **Sample project** — `public/samples/abl/` loads automatically so you can try the IDE immediately
- **Themes** — dark default, light toggle, and a customization panel (persisted in `localStorage`)
- **Terminal** — xterm.js over the virtual workspace only (no OS shell / Progress runtime)

## Requirements

- Node.js 20+ (`node -v`)
- npm 10+ (bundled with Node)
- A Chromium-based browser for full folder open/save; other browsers can use the folder-input fallback and Samples

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

To edit without a folder: **New File** → choose a template → edit (dirty tabs show `*`) → **Save**.

Or production:

```bash
npm run build
npm start
```

(`dev` / `start` already bind port `43127`.)

## Troubleshooting: `npm install` fails with `EEXIST` / `EACCES` in `~/.npm/_cacache`

This is a **local npm cache** problem on your machine (corrupted or root-owned cache entries), not a broken dependency in this repo. Typical log lines:

```text
npm error code EEXIST
npm error errno EEXIST
… EACCES: permission denied, rename '…/.npm/_cacache/tmp/…' -> '…/.npm/_cacache/content-v2/…'
```

### Fix (macOS / Linux)

Run these in a normal terminal (not as root / not with `sudo npm`):

```bash
# 1) Fix ownership if the cache was ever written by sudo/root
sudo chown -R "$(whoami)" ~/.npm

# 2) Clear the corrupted cache
npm cache clean --force

# 3) Retry from the project root
cd /path/to/jabl
rm -rf node_modules
npm install
```

If it still fails:

```bash
# Bypass the broken global cache for this install only
npm install --cache /tmp/npm-cache-jabl
```

Or reset the whole cache directory (safe; npm will recreate it):

```bash
rm -rf ~/.npm/_cacache
npm install
```

**Do not** use `sudo npm install` in the project — that often re-creates the permission problem.

See [`notes/errors.txt`](notes/errors.txt) for a captured example of this failure.

## Out of scope

See [`notes/notes.txt`](notes/notes.txt) under `[future]` — real OpenEdge compiler/runtime, LSP, Electron packaging, and multi-user auth are not part of this slice.
