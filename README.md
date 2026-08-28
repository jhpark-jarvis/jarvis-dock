# Dock

> 로컬 Markdown 작성 중, 리서치부터 링크·이미지 삽입까지.

[![CI](https://github.com/jhpark-jarvis/jarvis-dock/actions/workflows/desktop-ci.yml/badge.svg)](https://github.com/jhpark-jarvis/jarvis-dock/actions/workflows/desktop-ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Dock은 기술 문서를 작성하다가 브라우저와 파일 탐색기 사이를 오가는 시간을 줄이는 로컬 우선(Local-first) Electron 워크스페이스다. 문서는 사용자가 선택한 폴더에 그대로 저장되고, 검색 결과와 이미지는 필요한 순간에만 안전한 Markdown으로 들어간다.

## 핵심 경험

| 흐름 | Dock에서 처리하는 일 |
| --- | --- |
| 문서 작성 | 로컬 폴더 선택 → Markdown 열기·생성·편집·저장 |
| 링크 리서치 | `/link` → Research View에서 검색 → 결과 카드 또는 현재 페이지를 커서 위치에 삽입 |
| 이미지 리서치 | `/image` → Wikimedia Commons 검색 → 출처·라이선스 확인 → `assets/` 저장 및 삽입 |
| 문서 탐색 | Markdown 미리보기, 상대 링크 이동, 문서 개요, 이미지 자산 패널 |

링크와 이미지 삽입은 Editor의 현재 선택 영역을 보존한다. 저장된 원본은 document workspace 내부에서만 관리하며, 미리보기는 검증된 로컬 자산만 읽는다.

## 빠른 시작

요구 사항: Node.js `22.12.0+`, npm

```powershell
git clone https://github.com/jhpark-jarvis/jarvis-dock.git
Set-Location jarvis-dock
npm ci
npm run dev
```

최상위 디렉터리는 npm workspace 명령의 실행 지점이고, 데스크톱 앱은 [`apps/desktop`](apps/desktop)에 있다. 하위 `package-lock.json`은 만들지 않는다.

## 개발 명령

```powershell
npm run check       # typecheck, lint, format, unit/component/IPC contract tests
npm run test:e2e    # Electron packaged bundle E2E
npm run test:smoke  # Windows packaged executable smoke test
npm run package     # Electron 앱 패키징
npm run make        # 설치 패키지 생성
```

현재 검증 기준:

- `npm run check`: 89개 테스트 통과
- `npm run test:e2e`: 12개 시나리오 통과
- Windows x64 packaged smoke 및 installer 생성 통과
- macOS/Linux package 검증은 CI에서 수행하며, runtime GUI 검증은 릴리스 전 항목

## 설계 원칙

```text
Renderer UI  →  좁은 Preload API  →  Main 권한 경계  →  파일 시스템·외부 콘텐츠
```

- Renderer에는 Node.js, Electron, 파일 시스템 권한을 노출하지 않는다.
- 모든 IPC 입력과 외부 URL을 런타임 검증한다.
- document workspace 바깥의 경로, `..`, symbolic link 우회를 차단한다.
- Markdown raw HTML과 위험한 URL scheme을 미리보기에서 제거한다.
- Research View의 원격 페이지는 별도 격리 영역에서 실행하고, Renderer에는 사용자가 선택한 제목과 검증된 HTTPS URL만 전달한다.
- 이미지 다운로드는 HTTPS, redirect, timeout, MIME, magic bytes, 파일 크기, 저장 경로를 검증한다.

## Research View의 범위

`/link`의 Google 결과 카드 추출은 현재 실험적 로컬 기능이다. Google의 `Sorry` 차단, selector 변경, locale 차이로 카드가 비어 있을 수 있으며, 이 경우 Research View에서 현재 페이지 링크를 직접 삽입할 수 있다. 사용자 Chrome 프로필 복제나 User-Agent 위조는 사용하지 않는다.

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

변경 후 `npm run check`를 실행하고, 영향받는 기능은 패키징·E2E 검증까지 확인한다. 앱 소스는 [`apps/desktop`](apps/desktop)에 있으며 모든 npm 명령은 저장소 루트에서 실행한다.

## 라이선스

[MIT License](LICENSE) · Copyright (c) 2026 jhpark-jarvis
