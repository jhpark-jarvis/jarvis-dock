# Dock

> 문서 작성, 리서치, Markdown 삽입을 한 곳에서.

[![CI](https://github.com/jhpark-jarvis/jarvis-dock/actions/workflows/desktop-ci.yml/badge.svg)](https://github.com/jhpark-jarvis/jarvis-dock/actions/workflows/desktop-ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Dock은 기술 문서를 작성하면서 웹 자료를 찾아 링크와 이미지를 바로 삽입할 수 있는 로컬 우선(Local-first) Electron 데스크톱 워크스페이스입니다. 문서는 사용자가 선택한 폴더에 그대로 저장되며, Dock은 브라우저와 파일 탐색기 사이의 불필요한 전환을 줄입니다.

## 핵심 경험

| 흐름 | Dock에서 처리하는 일 |
| --- | --- |
| 문서 작성 | 로컬 폴더 선택 → Markdown 열기·생성·편집·저장 |
| 링크 리서치 | `/link` → Research View에서 검색 → 결과 카드 또는 현재 페이지 링크를 커서 위치에 삽입 |
| 이미지 리서치 | `/image` → Wikimedia Commons 검색 → 출처·라이선스 확인 → `assets/`에 저장하고 삽입 |
| 문서 탐색 | Markdown 미리보기, 상대 링크 이동, 문서 개요, 이미지 자산 패널 |

Editor에서 선택한 위치를 유지한 채 링크와 이미지를 삽입할 수 있습니다. 이미지 원본은 document workspace 내부에서만 관리하며, 미리보기는 검증된 로컬 자산만 읽습니다.

## 빠른 시작

필수 환경: Node.js `22.12.0+`, npm

```powershell
git clone https://github.com/jhpark-jarvis/jarvis-dock.git
Set-Location jarvis-dock
npm ci
npm run dev
```

저장소 루트에서 npm workspace 명령을 실행하며, 데스크톱 앱은 [`apps/desktop`](apps/desktop)에 있습니다. 하위 디렉터리에 별도의 `package-lock.json`을 만들지 않습니다.

## 개발 명령

```powershell
npm run check       # typecheck, lint, format, unit/component/IPC contract tests
npm run test:e2e    # Electron packaged bundle E2E
npm run test:smoke  # Windows packaged executable smoke test
npm run package     # Electron 앱 패키징
npm run make        # 설치 패키지 생성
```

검증 현황:

- `npm run check`: 89개 테스트 통과
- `npm run test:e2e`: 12개 시나리오 통과
- Windows x64 패키지 smoke 테스트 및 설치 패키지 생성 통과
- macOS·Linux 패키지 검증은 CI에서 수행하며, 실제 GUI 검증은 릴리스 전 진행 예정

## 설계 원칙

```text
Renderer UI  →  좁은 Preload API  →  Main 권한 경계  →  파일 시스템·외부 콘텐츠
```

- Renderer에는 Node.js, Electron, 파일 시스템 권한을 노출하지 않습니다.
- 모든 IPC 입력과 외부 URL을 런타임에 검증합니다.
- document workspace 바깥의 경로, `..`, symbolic link를 통한 우회를 차단합니다.
- Markdown raw HTML과 위험한 URL scheme은 미리보기에서 제거합니다.
- Research View의 원격 페이지는 별도 격리 영역에서 실행하며, Renderer에는 사용자가 선택한 제목과 검증된 HTTPS URL만 전달합니다.
- 이미지 다운로드 시 HTTPS, redirect, timeout, MIME, magic bytes, 파일 크기, 저장 경로를 검증합니다.

## Research View의 범위

`/link`의 Google 검색 결과 카드 추출은 현재 로컬 실험 기능입니다. Google의 `Sorry` 차단이나 selector·locale 차이로 카드가 표시되지 않을 수 있습니다. 이때는 Research View에서 현재 페이지 링크를 직접 삽입할 수 있습니다. 사용자 Chrome 프로필 복제와 User-Agent 위조는 사용하지 않습니다.

## 프로젝트 구조

```text
jarvis-dock/
├─ apps/desktop/   # Electron + React 데스크톱 앱
├─ docs/           # 제품·아키텍처·보안·테스트·ADR
├─ packages/       # 공유 패키지 예약 영역
├─ plugins/        # 확장 기능 예약 영역
└─ scripts/        # 저장소 자동화 예약 영역
```

## 개발

변경한 뒤에는 `npm run check`를 실행하고, 영향받는 기능은 패키징·E2E 검증까지 확인합니다. 앱 소스는 [`apps/desktop`](apps/desktop)에 있으며, 모든 npm 명령은 저장소 루트에서 실행합니다.

## 라이선스

[MIT License](LICENSE) · Copyright (c) 2026 jhpark-jarvis
