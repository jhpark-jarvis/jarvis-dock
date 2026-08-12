# Dock Plugins

`plugins/`는 미래의 Dock 런타임 확장 기능 또는 공식 예제를 위한 예약 공간이다.

이 디렉터리는 Electron Forge의 `@electron-forge/plugin-*` 패키지와 관계가 없다.

MVP 규칙:

- Plugin API를 구현하지 않는다.
- `/link`, `/image` built-in command를 이 디렉터리에 넣지 않는다.
- 빈 placeholder plugin을 만들지 않는다.
- 이 README만 유지할 수 있다.

Plugin API 도입 전에는 신뢰, 권한, 프로세스 격리, 파일/네트워크 접근, 버전 호환성을 다루는 Accepted ADR이 필요하다.
