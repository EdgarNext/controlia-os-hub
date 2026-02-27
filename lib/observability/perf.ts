const isProduction = process.env.NODE_ENV === "production";
const isDebugEnabled = process.env.DEBUG_PERF === "1";
const defaultThresholdMs = Number.parseInt(process.env.HUB_PERF_THRESHOLD_MS ?? "50", 10);
const thresholdMs = Number.isFinite(defaultThresholdMs) ? defaultThresholdMs : 50;

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function shouldLog(durationMs: number) {
  if (isProduction) {
    return false;
  }

  return isDebugEnabled || durationMs > thresholdMs;
}

export function perfMark(name: string) {
  if (isProduction) {
    return 0;
  }

  void name;
  return nowMs();
}

export function perfMeasure(name: string, startMark: number) {
  if (isProduction || startMark === 0) {
    return;
  }

  const durationMs = nowMs() - startMark;

  if (!shouldLog(durationMs)) {
    return;
  }

  // One-line log for low-noise perf diagnostics in dev.
  console.info(`[perf] hub ${name} ${durationMs.toFixed(1)}ms`);
}
