export const DOCUMENT_TEMPLATES = [
  {
    id: 'blank',
    label: '빈 문서',
    content: '',
  },
  {
    id: 'daily-note',
    label: '일일 기록',
    content: '# 오늘의 기록\n\n## 목표\n\n- \n\n## 메모\n\n',
  },
  {
    id: 'meeting-note',
    label: '회의 기록',
    content:
      '# 회의 제목\n\n- 일시: \n- 참석자: \n\n## 안건\n\n1. \n\n## 결정 사항\n\n- \n\n## 후속 작업\n\n- [ ] \n',
  },
  {
    id: 'technical-note',
    label: '기술 노트',
    content:
      '# 기술 노트 제목\n\n## 배경\n\n## 핵심 내용\n\n## 예시\n\n```text\n\n```\n\n## 참고\n\n- \n',
  },
] as const;

export type DocumentTemplateId = (typeof DOCUMENT_TEMPLATES)[number]['id'];

export const getDocumentTemplate = (id: DocumentTemplateId): string =>
  DOCUMENT_TEMPLATES.find((template) => template.id === id)?.content ?? '';
