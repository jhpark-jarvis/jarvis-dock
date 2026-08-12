# Dock

> Open-source developer workspace by JARVIS

Dock은 개발자가 기술 문서를 작성하면서 웹 검색, 이미지 검색, 링크 삽입, 로컬 파일 작업을 한 흐름 안에서 처리하도록 돕는 크로스플랫폼 데스크톱 워크스페이스다.

핵심 목표는 문서 작성 중 발생하는 불필요한 브라우저 왕복과 컨텍스트 스위칭을 줄이는 것이다.

## Project Status

현재 프로젝트는 기반 정리 단계다.

- Electron Forge + Vite + TypeScript 템플릿 생성 완료
- Electron 앱을 `apps/desktop`으로 이동 완료
- 루트 npm workspace 구성 완료
- Windows package 검증 완료
- React 통합 전
- 테스트 기반 구성 전
- MVP 기능 구현 전

정확한 현재 상태와 다음 작업은 `docs/CURRENT_STATUS.md`를 따른다.

## Fixed Direction

- Product: `Dock`
- Brand: `JARVIS`
- Repository: `jarvis-dock`
- Desktop: Electron
- Frontend: React
- Language: TypeScript
- Bundler: Vite
- Target platforms: Windows, macOS, Linux
- Desktop app location: `apps/desktop`

## Documentation

작업을 시작하기 전에 `AGENTS.md`를 먼저 읽는다.

- Constitution: `docs/00_CONSTITUTION.md`
- MVP: `docs/01_PRODUCT_MVP.md`
- Architecture: `docs/02_ARCHITECTURE.md`
- Security: `docs/03_SECURITY.md`
- Testing: `docs/04_TESTING.md`
- Workflow: `docs/05_WORKFLOW.md`
- Glossary: `docs/06_GLOSSARY.md`
- Current status: `docs/CURRENT_STATUS.md`
- Decisions: `docs/adr/README.md`

## Repository Shape

아래는 저장소의 최소 필수 구조다. 저장소 운영에 필요한 설정 파일과 승인된 디렉터리는 추가할 수 있다.

```text
jarvis-dock/
├─ apps/
│  └─ desktop/
├─ plugins/
├─ packages/
├─ docs/
├─ scripts/
├─ AGENTS.md
├─ README.md
└─ LICENSE
```

현재 Electron 앱과 예약 디렉터리는 이 구조에 맞게 정렬되어 있다. 정확한 구현 상태와 알려진 문제는 `docs/CURRENT_STATUS.md`, 사람이 바로 실행할 다음 순서는 `docs/NEXT_STEPS.md`를 따른다.

## License

프로젝트는 오픈소스로 진행한다. 구체적인 라이선스는 프로젝트 소유자가 명시적으로 확정한 뒤 루트 `LICENSE` 파일로 기록한다. 라이선스가 확정되기 전에는 공개 릴리스를 만들지 않는다.
