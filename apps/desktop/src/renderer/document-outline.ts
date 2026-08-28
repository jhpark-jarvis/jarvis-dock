export interface DocumentOutlineItem {
  level: number;
  line: number;
  text: string;
}

const headingPattern = /^ {0,3}(#{1,6})[ \t]+(.+?)\s*$/;
const fencePattern = /^ {0,3}(```|~~~)/;

export const extractDocumentOutline = (
  markdown: string,
): DocumentOutlineItem[] => {
  const outline: DocumentOutlineItem[] = [];
  let insideFence = false;

  markdown.split(/\r?\n/).forEach((line, lineIndex) => {
    if (fencePattern.test(line)) {
      insideFence = !insideFence;
      return;
    }
    if (insideFence) return;

    const match = line.match(headingPattern);
    if (!match) return;

    const text = match[2].replace(/[ \t]+#+[ \t]*$/, '').trim();
    if (!text) return;

    outline.push({
      level: match[1].length,
      line: lineIndex,
      text,
    });
  });

  return outline;
};
