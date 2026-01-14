export const init = () => {};
export const setUser = () => {};
export const captureException = () => {};
export const captureMessage = () => {};
export const withScope = (fn: () => void) => fn();
export default {
  init,
  setUser,
  captureException,
  captureMessage,
  withScope,
};
