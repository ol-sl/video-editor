/**
 * Memory monitoring utilities for preventing browser crashes
 */

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

/**
 * Check if performance.memory API is available (Chrome only)
 */
export function isMemoryAPIAvailable(): boolean {
  return 'memory' in performance;
}

/**
 * Get current memory usage information
 */
export function getMemoryInfo(): MemoryInfo | null {
  if (!isMemoryAPIAvailable()) {
    return null;
  }

  const memory = (performance as any).memory;
  return {
    usedJSHeapSize: memory.usedJSHeapSize,
    totalJSHeapSize: memory.totalJSHeapSize,
    jsHeapSizeLimit: memory.jsHeapSizeLimit,
  };
}

/**
 * Get memory usage percentage
 */
export function getMemoryUsagePercentage(): number {
  const info = getMemoryInfo();
  if (!info) return 0;
  
  return (info.usedJSHeapSize / info.jsHeapSizeLimit) * 100;
}

/**
 * Format memory size to human-readable string
 */
export function formatMemorySize(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  const gb = mb / 1024;
  
  if (gb >= 1) {
    return `${gb.toFixed(2)} GB`;
  }
  return `${mb.toFixed(2)} MB`;
}

/**
 * Check if memory usage is approaching critical levels
 */
export function isMemoryCritical(): boolean {
  const usage = getMemoryUsagePercentage();
  return usage > 85; // Alert at 85% usage
}

/**
 * Monitor memory usage and warn user
 */
export function monitorMemory(callback: (usage: number, critical: boolean) => void): () => void {
  if (!isMemoryAPIAvailable()) {
    console.warn('Memory monitoring not available in this browser');
    return () => {};
  }

  const interval = setInterval(() => {
    const usage = getMemoryUsagePercentage();
    const critical = isMemoryCritical();
    callback(usage, critical);
  }, 5000); // Check every 5 seconds

  return () => clearInterval(interval);
}

/**
 * Suggest garbage collection (Chrome only, requires --js-flags=--expose-gc)
 */
export function suggestGarbageCollection(): void {
  if ('gc' in window) {
    (window as any).gc();
  }
}
