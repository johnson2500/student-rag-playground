// Setup file for vitest
// scrollIntoView is not implemented in jsdom
window.HTMLElement.prototype.scrollIntoView = () => {};
