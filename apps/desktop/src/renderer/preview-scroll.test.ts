import { describe, expect, it } from 'vitest';
import { getScrollRatio, setScrollRatio } from './preview-scroll';

const createScrollable = (scrollTop = 0) => ({
  scrollTop,
  scrollHeight: 1000,
  clientHeight: 200,
});

describe('preview scroll synchronization', () => {
  it('converts a scroll position to a bounded ratio', () => {
    expect(getScrollRatio(createScrollable(400))).toBe(0.5);
    expect(getScrollRatio(createScrollable(-10))).toBe(0);
    expect(getScrollRatio(createScrollable(1200))).toBe(1);
  });

  it('applies a ratio to a scrollable element', () => {
    const element = createScrollable();

    setScrollRatio(element, 0.75);

    expect(element.scrollTop).toBe(600);
  });

  it('handles elements without a scrollable area', () => {
    const element = {
      scrollTop: 12,
      scrollHeight: 100,
      clientHeight: 100,
    };

    expect(getScrollRatio(element)).toBe(0);
    setScrollRatio(element, 0.5);
    expect(element.scrollTop).toBe(0);
  });
});
