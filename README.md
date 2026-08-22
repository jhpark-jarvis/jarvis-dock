# Dock

> Markdown developer workspace

Dock은 로컬 Markdown 기술 문서를 작성하는 동안 자료를 확인하고, 링크와 이미지를 안전한 Markdown 문법으로 삽입하도록 돕는 Electron 데스크톱 앱입니다. 문서 원본은 사용자가 선택한 로컬 폴더에 그대로 남으며, Git과 일반 파일 탐색기로 계속 관리할 수 있습니다.

## 현재 제공하는 흐름

- document workspace 선택, Markdown 목록 조회·생성·열기·UTF-8 저장
- 안전한 Markdown 미리보기와 document workspace 내부 상대 링크 이동
- `/link`으로 별도 Research View에서 Google 검색 시작
  - 실험적 로컬 범위에서 렌더링된 결과의 제목·HTTPS URL 카드 최대 10개 표시
  - 카드 선택 또는 현재 페이지 링크를 현재 커서 위치에 Markdown으로 삽입
- `/image`으로 Wikimedia Commons 이미지 검색, 출처·라이선스 확인, 검증된 다운로드와 `assets/` 저장, 상대 경로 Markdown 삽입

## 빠른 시작

요구 사항: Node.js `22.12.0` 이상, npm, Windows 개발 환경의 Electron 실행 가능 상태입니다.

```powershell
git clone https://github.com/jhpark-jarvis/jarvis-dock.git
Set-Location jarvis-dock
npm ci
npm run dev
```

최상위 디렉터리는 npm workspace 명령의 실행 지점이며, 데스크톱 앱은 `apps/desktop`에 있습니다. 앱별 `package-lock.json`을 만들지 않습니다.

## 주요 명령

```powershell
npm run check       # typecheck, lint, format check, unit/component/contract tests
npm run test:e2e    # packaged bundle 기반 Electron E2E
npm run test:smoke  # Windows packaged executable smoke
npm run package     # Electron Forge package
npm run make        # 설치 패키지 생성
```

2026-08-22 기준 `npm run check`은 60개 테스트, `npm run test:e2e`는 5개 시나리오를 통과했습니다. Windows x64 packaged smoke도 통과했으며, macOS와 Linux 패키징 검증은 아직 남아 있습니다.

## 보안과 데이터 경계

Dock은 Main, Preload, Renderer를 분리합니다. Renderer는 Node.js·Electron·파일 시스템에 직접 접근하지 못하며, 기능별 `window.dock` API와 런타임 IPC 검증만 사용합니다.

- document workspace 밖 경로, `..`, symbolic link 우회 차단
- Markdown raw HTML과 위험한 URL scheme 차단
- Research View에서 permission·popup·download 거부, 원격 페이지에 Dock API 미노출
- 링크 카드는 제목과 검증된 HTTPS URL만 Renderer에 전달
- 이미지 다운로드에서 HTTPS host, redirect, timeout, 10 MiB, MIME, magic bytes, 저장 경로 검증

`/link` 카드 추출은 일반 배포 기능이 아닌 실험적 로컬 기능입니다. 원본 HTML·DOM·cookie·request header는 저장하거나 Renderer로 전달하지 않습니다. Google 결과의 selector와 locale 차이는 아직 수동 검증 대상이며, 카드가 비어 있으면 현재 Research View 페이지 링크 삽입을 사용할 수 있습니다.

## 프로젝트 구조

```text
jarvis-dock/
├─ apps/desktop/   # Electron + React 앱
├─ packages/       # 향후 공유 패키지 예약
├─ plugins/        # MVP 이후 plugin 영역 예약
└─ scripts/        # 저장소 자동화 영역 예약
```

## 라이선스

오픈소스 공개를 목표로 하지만, 아직 루트 `LICENSE` 파일과 최종 라이선스 결정이 없습니다. 라이선스가 확정되기 전에는 공개 릴리스를 만들지 않습니다.
