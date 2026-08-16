# Desktop Tests

이 디렉터리는 실제 프로세스 또는 패키징 산출물을 사용하는 데스크톱 앱 테스트를 위한 공간이다.

목표 구조:

```text
tests/
├─ e2e/
├─ fixtures/
└─ smoke/
```

`tests/e2e/`는 Playwright의 Electron API로 Main, Preload, Renderer의 실제 연결을 검증한다.

- `npm run test:e2e`는 먼저 Forge Vite 번들을 만든 뒤, 개발용 Electron 실행 파일로 `.vite` 번들을 연다.
- E2E는 패키징된 앱을 실행하지 않는다. production fuse를 약화하지 않기 위해 packaged smoke와 분리한다.
- Electron 전용 E2E에는 Playwright 브라우저 binary 설치가 필요 없다.

`tests/smoke/`는 실제 package 산출물을 검사한다.

- `npm run test:smoke`는 Windows package 실행 파일의 존재와 production fuse 상태를 확인한 뒤, 생성된 실행 파일을 기동한다.
- 실행 파일이 3초 안에 비정상 종료하지 않으면 smoke가 시작한 프로세스만 종료한다.
- 화면 표시와 preload 연결은 production inspect fuse를 유지하기 위해 자동화하지 않으며, 릴리스 전 수동 smoke로 확인한다.
