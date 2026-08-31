import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [, , targetRoot] = process.argv;
if (!targetRoot) {
  console.error(
    '사용법: node scripts/create-editor-performance-fixtures.mjs <Dock_test-path>',
  );
  process.exit(1);
}

const root = path.resolve(targetRoot);
const performanceRoot = path.join(root, 'editor-performance');
const repeatedMarkdown = `
## 입력 성능 측정 블록

문서 입력과 Preview 갱신 비용을 측정하기 위한 반복 콘텐츠입니다. 일반 문장, **강조**, [문서 링크](../guide.md), 표와 코드 블록이 함께 포함됩니다.

| 항목 | 상태 | 설명 |
|---|---|---|
| Editor | active | 입력 burst 측정 |
| Preview | active | Markdown 렌더링 측정 |

\`\`\`ts
export const measure = (value: string) => value.length;
\`\`\`
`;

const buildFixture = (targetBytes) => {
  let content = '# Editor Performance Fixture\n\n';
  while (Buffer.byteLength(content, 'utf8') < targetBytes) {
    content += repeatedMarkdown;
  }
  return content;
};

const files = [
  ['input-10kb.md', 10_000],
  ['input-100kb.md', 100_000],
  ['input-500kb.md', 500_000],
  ['input-1mb.md', 1_000_000],
];

const qaScenario = `# Dock 중간 QA 시나리오

이 폴더는 Editor 입력 지연과 Preview 처리 비용을 비교하기 위한 전용 데이터입니다.

## 입력·Preview

1. \`input-10kb.md\`부터 \`input-1mb.md\`까지 순서대로 엽니다.
2. 각 문서의 마지막 줄에 20자 이상 입력합니다.
3. 입력이 화면에 반영될 때까지 체감 지연과 telemetry 로그의 \`editor-input-burst\`를 확인합니다.
4. 표·코드·링크가 포함된 Preview가 정상인지 확인합니다.

## Explorer·문서 작업

- \`move-source/move-me.md\`를 \`move-target/\`으로 이동합니다.
- \`rename-me.md\`의 이름을 바꿉니다.
- \`delete-me.md\`를 삭제하고, \`create-target/\`에 새 Markdown 파일을 만듭니다.
- \`folder-a/folder-b/nested.md\`를 열어 접기·펼치기와 문서 탭을 확인합니다.

## Mermaid·이미지·Research

- \`diagram.md\`에서 Mermaid, 표, 코드 Preview를 확인합니다.
- 기존 \`../assets/dock-sample.png\`를 삽입하고 Preview 렌더링을 확인합니다.
- 캡처 이미지를 붙여넣어 assets 저장과 Markdown 삽입을 확인합니다.
- \`/link\` 또는 Research View에서 링크 검색·삽입을 확인합니다.

QA 시작 시 실행 대상 마지막 commit SHA를 기록합니다. 로그는 앱의 \`app.getPath('logs')/dock-runtime\` 아래 JSONL이며 다음 명령으로 요약합니다.

\`\`\`powershell
node scripts/analyze-runtime-telemetry.mjs <jsonl-path>
\`\`\`
`;

const diagram = `# Mermaid and Markdown Fixture

## Mermaid

\`\`\`mermaid
flowchart TD
    A[입력] --> B[Markdown Preview]
    B --> C[Telemetry 기록]
\`\`\`

## Image

![Dock sample](../assets/dock-sample.png)
`;

await mkdir(path.join(performanceRoot, 'move-source'), { recursive: true });
await mkdir(path.join(performanceRoot, 'move-target'), { recursive: true });
await mkdir(path.join(performanceRoot, 'folder-a', 'folder-b'), {
  recursive: true,
});
await mkdir(path.join(performanceRoot, 'create-target'), { recursive: true });
await Promise.all(
  files.map(([name, size]) =>
    writeFile(path.join(performanceRoot, name), buildFixture(size), 'utf8'),
  ),
);
await Promise.all([
  writeFile(path.join(performanceRoot, 'QA_SCENARIO.md'), qaScenario, 'utf8'),
  writeFile(path.join(performanceRoot, 'diagram.md'), diagram, 'utf8'),
  writeFile(
    path.join(performanceRoot, 'move-source', 'move-me.md'),
    '# Move me\n',
    'utf8',
  ),
  writeFile(
    path.join(performanceRoot, 'move-target', 'keep.md'),
    '# Move target\n',
    'utf8',
  ),
  writeFile(
    path.join(performanceRoot, 'folder-a', 'folder-b', 'nested.md'),
    '# Nested document\n',
    'utf8',
  ),
  writeFile(
    path.join(performanceRoot, 'create-target', 'README.md'),
    '# Create target\n',
    'utf8',
  ),
  writeFile(
    path.join(performanceRoot, 'rename-me.md'),
    '# Rename me\n',
    'utf8',
  ),
  writeFile(
    path.join(performanceRoot, 'delete-me.md'),
    '# Delete me\n',
    'utf8',
  ),
]);
console.log(`생성 완료: ${performanceRoot}`);
