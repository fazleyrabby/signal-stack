/**
 * Wait for a specified amount of time
 * @param ms - Milliseconds to wait
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
