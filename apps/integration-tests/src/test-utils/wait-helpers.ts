/**
 * Wait for a condition to become true (polling pattern)
 * 
 * Used to wait for async operations like SQS message processing
 * 
 * @param condition - Function that returns true when ready
 * @param options - timeout and polling interval
 */
export async function waitForCondition(
  condition: () => Promise<boolean>,
  options: { timeout: number; interval: number }
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < options.timeout) {
    if (await condition()) {
      return;
    }
    
    await new Promise(resolve => setTimeout(resolve, options.interval));
  }
  
  throw new Error(
    `Timeout waiting for condition after ${options.timeout}ms`
  );
}

