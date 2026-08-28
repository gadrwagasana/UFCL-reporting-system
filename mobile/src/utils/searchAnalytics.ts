// Lightweight hook point for Global Search analytics. Intentionally a no-op in
// production until a real analytics pipeline is wired up — this just gives that
// future integration one well-named place to plug into.
export function trackSearchEvent(event: string, payload?: Record<string, unknown>): void {
  if (__DEV__) {
    console.log('[search-analytics]', event, payload);
  }
}
