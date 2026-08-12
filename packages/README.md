# Shared Packages

`packages/`는 실제 재사용 또는 안정된 독립 경계가 증명된 공용 모듈을 위한 공간이다.

패키지 생성 조건:

1. 둘 이상의 실제 consumer가 사용하거나,
2. 독립 테스트와 공개 계약이 필요한 안정된 경계여야 한다.

그리고 Architecture 문서 또는 ADR에 이동 이유를 기록해야 한다.

MVP 초기에 `editor-core`, `command-system`, `markdown-engine`, `shared`, `ui` 같은 이름의 빈 패키지를 미리 만들지 않는다.
