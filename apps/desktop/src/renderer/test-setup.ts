import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

Object.defineProperty(SVGElement.prototype, 'getBBox', {
  configurable: true,
  value: () => ({
    x: 0,
    y: 0,
    width: 100,
    height: 24,
    top: 0,
    right: 100,
    bottom: 24,
    left: 0,
  }),
});

Object.defineProperty(SVGElement.prototype, 'getComputedTextLength', {
  configurable: true,
  value: () => 80,
});

afterEach(cleanup);
