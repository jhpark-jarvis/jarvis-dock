# Applications

`apps/`는 실행 가능한 애플리케이션의 공식 위치다.

현재 확정된 앱:

- `apps/desktop`: Electron 기반 Dock 데스크톱 앱

Electron Forge 템플릿은 `apps/desktop`으로 이동되었다. 저장소 루트의 npm script가 이 앱 workspace의 script를 호출한다.

새 앱을 추가하려면 실제 제품 요구와 ADR이 필요하다. “언젠가 필요할 수 있다”는 이유로 빈 web 또는 CLI 앱을 만들지 않는다.
