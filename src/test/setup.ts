import '@testing-library/jest-dom/vitest';

// jsdom n'implémente pas ResizeObserver (requis par ResponsiveContainer de recharts).
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
