const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/**
 * The API only exists in local development. On the public static site (and any other host) files stay in the
 * browser: no request carrying a visitor's model is ever sent.
 */
export function shouldUseBackend(hostname: string = window.location.hostname): boolean {
  return LOCAL_HOSTS.includes(hostname);
}
