/** Whether the offline shell should be installed: production build, secure context, not a recording session. */
export function shouldRegisterWorker(env: {
  production: boolean;
  hasServiceWorker: boolean;
  secure: boolean;
  recording: boolean;
}): boolean {
  return env.production && env.hasServiceWorker && env.secure && !env.recording;
}

export function registerWorker(recording: boolean): void {
  const allowed = shouldRegisterWorker({
    production: import.meta.env.PROD,
    hasServiceWorker: 'serviceWorker' in navigator,
    secure: window.isSecureContext,
    recording,
  });
  if (!allowed) return;
  // Registered after load so the first paint never waits for it. A failure only means no offline mode.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI)).catch(() => undefined);
  });
}
