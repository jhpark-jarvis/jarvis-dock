export const isTrustedRendererUrl = (
  senderUrl: string,
  rendererUrl: string,
): boolean => {
  try {
    return new URL(senderUrl).toString() === new URL(rendererUrl).toString();
  } catch {
    return false;
  }
};
