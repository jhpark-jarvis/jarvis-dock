# Dock Desktop

이 디렉터리는 Dock의 Electron 데스크톱 애플리케이션이다.

```text
src/
├─ main/       Electron Main process
├─ preload/    contextBridge API
├─ renderer/   사용자 UI
└─ shared/     프로세스 간 계약과 순수 유틸
```

현재는 Electron Forge의 Vite TypeScript 기본 템플릿만 구조에 맞게 이동한 상태다. React, 테스트 도구, Markdown 편집기, 검색 기능은 아직 추가되지 않았다.

개발 명령은 저장소 루트에서 실행한다.

```text
npm run dev
npm run typecheck
npm run lint
npm run package
```
