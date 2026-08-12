# Shared Contracts

이 디렉터리는 Main, Preload, Renderer가 함께 사용하는 직렬화 가능한 타입, IPC 계약, 런타임 스키마, 부작용 없는 유틸을 위한 공간이다.

현재는 아직 shared 코드가 없다.

금지:

- Electron import
- React import
- 파일 시스템 접근
- 환경에 의존하는 부작용
