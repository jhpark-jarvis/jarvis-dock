# Repository Scripts

`scripts/`는 저장소 전체의 반복 작업을 자동화하는 공식 위치다.

예:

- 구조 검증
- 릴리스 artifact 검증
- 플랫폼별 smoke 실행
- 문서 링크 검증

한 번만 사용하는 명령이나 앱 내부 구현을 억지로 script로 만들지 않는다.

스크립트는 다음을 지켜야 한다.

- 실패 시 non-zero exit code
- 대상 경로 명시
- 사용자 데이터 삭제 금지
- 파괴적 동작 전 검증
- Windows, macOS, Linux 차이 문서화
