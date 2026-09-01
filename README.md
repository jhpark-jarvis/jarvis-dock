# Dock

> 로컬 Markdown 문서 작성과 리서치를 하나의 흐름으로.

[![CI](https://github.com/jhpark-jarvis/jarvis-dock/actions/workflows/desktop-ci.yml/badge.svg)](https://github.com/jhpark-jarvis/jarvis-dock/actions/workflows/desktop-ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-43.2.0-47848f.svg)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-149eca.svg)](https://react.dev/)

Dock은 개발자를 위한 로컬 우선 Markdown 데스크톱 워크스페이스입니다. 선택한 로컬 폴더에서 문서를 작성하고, 링크와 이미지를 검색해 현재 커서 위치에 Markdown으로 삽입할 수 있습니다.

## 주요 기능

| 영역 | 기능 |
| --- | --- |
| 문서 | Markdown 열기·생성·편집·저장, UTF-8 원자적 저장 |
| Explorer | 파일·폴더 생성·이름 변경·삭제·이동, 외부 변경 동기화 |
| Editor | Markdown Preview, 코드 하이라이트, Mermaid, 문서 개요·검색·백링크·진단 |
| 링크 | `/link`, 격리된 Research View, 링크 카드 및 현재 페이지 fallback |
| 이미지 | `/image`, Wikimedia Commons 검색, 출처·라이선스, `assets/` 저장·삽입 |
| 설계 문서 | arc42·C4·ADR 생성, ADR Index 갱신, 정합성 검사 |

Research View의 Google 결과 카드 추출은 로컬 실험 기능입니다. Google의 차단 응답이나 selector·locale 차이로 카드가 표시되지 않을 수 있으며, 현재 페이지 링크 삽입을 fallback으로 제공합니다.

## 보안

```text
Renderer UI → 좁은 Preload API → Main 권한 경계
```

- Renderer에 Node.js, Electron, `fs`, `shell`, 범용 IPC를 노출하지 않습니다.
- 모든 IPC 입력과 외부 URL을 런타임에 검증합니다.
- workspace 밖의 경로, `..`, symbolic link 우회를 차단합니다.
- raw HTML과 위험한 URL scheme을 Preview에서 제거합니다.
- 이미지 다운로드의 URL, MIME, magic bytes, 크기, 저장 경로를 검증합니다.

## 시작하기

필수 환경: Node.js `22.12.0+`, npm

```powershell
git clone https://github.com/jhpark-jarvis/jarvis-dock.git
Set-Location jarvis-dock
npm ci
npm run dev
```

앱은 [`apps/desktop`](apps/desktop)에 있으며 npm 명령은 저장소 루트에서 실행합니다.

## 개발 명령

```powershell
npm run dev          # 개발 실행
npm run check        # 타입·lint·format·unit/component/IPC 테스트
npm run test:e2e     # Electron E2E
npm run test:smoke   # packaged 앱 smoke
npm run package      # 앱 패키징
npm run make         # 설치 패키지 생성
```

## 현재 상태

2026-09-01 기준 핵심 MVP 흐름은 구현됐으며 릴리스 전 안정화 단계입니다.

- `npm run check`: 35개 test file, 166개 테스트 통과
- `npm run test:e2e`: 21개 통과
- Windows x64 packaged smoke 및 Squirrel installer 생성 통과
- Windows·macOS·Linux CI package 검증 통과
- production dependency audit: 0 vulnerabilities

남은 검증은 macOS·Linux 실제 GUI, native file system 수동 확인과 대용량 workspace 성능 측정입니다.

## 로드맵

- QA 보완 항목 재검증 및 릴리스 전 플랫폼 확인
- 대용량 workspace 초기 로드·watcher·메모리 최적화
- 10KB·100KB·500KB·1MB Markdown Editor benchmark
- Editor 입력 지연 profiling 및 Preview/Mermaid 렌더링 최적화
- MVP 이후 task list, 충돌 diff·병합, 테마, Architecture UX 등을 검토

현재 MVP에는 AI Agent, Git 패널, Plugin API, MCP, 클라우드 동기화, 공동 편집, 모바일, 자동 업데이트, PDF·Word 편집을 포함하지 않습니다.

## 구조

```text
jarvis-dock/
├─ apps/desktop/   # Electron + React 앱
├─ docs/           # 제품·아키텍처·보안·테스트·ADR
├─ packages/       # 공유 패키지 영역
├─ plugins/        # 확장 기능 영역
└─ scripts/        # 자동화·성능 측정 도구
```

앱 내부는 `main`, `preload`, `renderer`, `shared` 경계를 유지합니다.

## 문서

- [프로젝트 헌법](docs/00_CONSTITUTION.md)
- [현재 상태](docs/CURRENT_STATUS.md)
- [다음 작업](docs/NEXT_STEPS.md)
- [제품 MVP](docs/01_PRODUCT_MVP.md)
- [아키텍처](docs/02_ARCHITECTURE.md)
- [보안](docs/03_SECURITY.md)
- [테스트](docs/04_TESTING.md)
- [ADR](docs/adr/README.md)

## 라이선스

[MIT License](LICENSE) · Copyright (c) 2026 jhpark-jarvis
