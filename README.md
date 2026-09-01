# Dock

> Local Markdown authoring and research, in one focused workspace.

[한국어](README.ko.md)

[![CI](https://github.com/jhpark-jarvis/jarvis-dock/actions/workflows/desktop-ci.yml/badge.svg)](https://github.com/jhpark-jarvis/jarvis-dock/actions/workflows/desktop-ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-43.2.0-47848f.svg)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-149eca.svg)](https://react.dev/)

Dock is a local-first Markdown desktop workspace for developers. Choose a local folder, write your documents, research links and images, and insert verified Markdown at the current cursor position.

## Highlights

| Area | What Dock provides |
| --- | --- |
| Documents | Open, create, edit, and save Markdown with UTF-8 atomic writes |
| Explorer | Create, rename, delete, and move files and folders with external change sync |
| Editor | Markdown Preview, code highlighting, Mermaid, outline, search, backlinks, and diagnostics |
| Links | `/link`, isolated Research View, link cards, and current-page fallback |
| Images | `/image`, Wikimedia Commons search, license metadata, and `assets/` storage |
| Architecture | Generate arc42, C4, and ADR documents with index updates and consistency checks |

Google result-card extraction in Research View is a local experiment. Google blocking responses or selector and locale differences may prevent cards from appearing; the current-page link fallback remains available.

## Security by default

```text
Renderer UI → Narrow Preload API → Main authority boundary
```

- No Node.js, Electron, `fs`, `shell`, or generic IPC is exposed to the Renderer.
- IPC inputs and external URLs are validated at runtime.
- Workspace escapes, `..` traversal, and symbolic-link bypasses are blocked.
- Raw HTML and dangerous URL schemes are removed from Preview.
- Image downloads validate the URL, MIME type, magic bytes, size, and destination.

## Quick start

Requirements: Node.js `22.12.0+` and npm.

```powershell
git clone https://github.com/jhpark-jarvis/jarvis-dock.git
Set-Location jarvis-dock
npm ci
npm run dev
```

The Electron app lives in [`apps/desktop`](apps/desktop). Run npm commands from the repository root.

## Development commands

```powershell
npm run dev          # Start the app
npm run check        # Typecheck, lint, format, and unit/component/IPC tests
npm run test:e2e     # Electron E2E tests
npm run test:smoke   # Packaged app smoke test
npm run package      # Package the app
npm run make         # Create an installer
```

## Status

As of 2026-09-01, the core MVP flows are implemented and the project is in release-hardening.

- `npm run check`: 35 test files, 166 tests passed
- `npm run test:e2e`: 21 tests passed
- Windows x64 packaged smoke and Squirrel installer creation passed
- Windows, macOS, and Linux CI package checks passed
- Production dependency audit: 0 vulnerabilities

Remaining validation covers macOS and Linux GUI/native file-system behavior and large-workspace performance.

## Roadmap

- Revalidate focused QA fixes and complete release-platform checks
- Measure and optimize large-workspace startup, watchers, and memory
- Benchmark 10KB, 100KB, 500KB, and 1MB Markdown editing
- Profile editor input latency and optimize Preview/Mermaid rendering
- Consider task lists, conflict diff/merge, themes, and Architecture UX after MVP

The MVP does not include AI agents, a Git panel, Plugin API, MCP, cloud sync, collaboration, mobile, auto-update, PDF/Word editing, WYSIWYG editing, accounts, or billing.

## Structure

```text
jarvis-dock/
├─ apps/desktop/   # Electron + React desktop app
├─ packages/       # Shared package area
├─ plugins/        # Extension area
├─ scripts/        # Automation and performance tools
├─ README.md       # Main documentation
└─ README.ko.md    # Korean translation
```

The app maintains explicit `main`, `preload`, `renderer`, and `shared` boundaries.

## License

[MIT License](LICENSE) · Copyright (c) 2026 jhpark-jarvis
