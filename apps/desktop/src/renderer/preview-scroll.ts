export type ScrollableElement = Pick<
  HTMLElement,
  'scrollTop' | 'scrollHeight' | 'clientHeight'
>;

export const getScrollRatio = (element: ScrollableElement): number => {
  const scrollableHeight = element.scrollHeight - element.clientHeight;
  if (scrollableHeight <= 0) return 0;
  return Math.min(1, Math.max(0, element.scrollTop / scrollableHeight));
};

export const setScrollRatio = (
  element: ScrollableElement,
  ratio: number,
): void => {
  const scrollableHeight = element.scrollHeight - element.clientHeight;
  if (scrollableHeight <= 0) {
    element.scrollTop = 0;
    return;
  }
  element.scrollTop = Math.min(1, Math.max(0, ratio)) * scrollableHeight;
};
