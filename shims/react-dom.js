// Stub for react-dom - not available in React Native
// Only used to satisfy @clerk/clerk-react web-only imports
'use strict';

module.exports = {
  createPortal: (children) => children,
  render: () => null,
  unmountComponentAtNode: () => false,
  findDOMNode: () => null,
  hydrate: () => null,
  unstable_batchedUpdates: (fn) => fn(),
  flushSync: (fn) => fn(),
};
