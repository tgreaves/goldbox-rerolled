// Single-file build: no service worker (it cannot run from file://).
export function registerSW(_options?: unknown): (reload?: boolean) => Promise<void> {
  return async () => {}
}
