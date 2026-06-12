import type { RuntimePerfTrace } from "./runtime-perf";

type RuntimeReadError = {
  code?: string;
  details?: string;
  hint?: string;
  message: string;
  name?: string;
};

type RuntimeReadResult<T> = {
  data: T | null;
  error: RuntimeReadError | null;
};

type RuntimeReadRetryInput<T> = {
  trace?: RuntimePerfTrace;
  step: string;
  query: (signal: AbortSignal) => PromiseLike<RuntimeReadResult<T>>;
  maxAttempts?: number;
  timeoutMs?: number;
};

const RETRYABLE_CODES = new Set([
  "ABORT_ERR",
  "ECONNREFUSED",
  "ECONNRESET",
  "EAI_AGAIN",
  "ENOTFOUND",
  "ETIMEDOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
]);

const RETRYABLE_PATTERNS = [
  /aborterror/i,
  /connection timed out/i,
  /econnrefused/i,
  /econnreset/i,
  /eai_again/i,
  /enotfound/i,
  /etimedout/i,
  /fetch failed/i,
  /headers timeout/i,
  /request was aborted/i,
  /socket/i,
  /timed out/i,
  /und_err_body_timeout/i,
  /und_err_connect_timeout/i,
  /und_err_headers_timeout/i,
];

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function roundMs(value: number) {
  return Math.round(value * 100) / 100;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBackoffMs(attempt: number) {
  const baseDelays = [100, 250, 500];
  const baseDelay = baseDelays[Math.min(attempt - 1, baseDelays.length - 1)];
  const jitter = Math.floor(Math.random() * 40);
  return baseDelay + jitter;
}

function normalizeThrownError(error: unknown): RuntimeReadError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      code:
        typeof (error as Error & { code?: unknown }).code === "string"
          ? (error as Error & { code?: string }).code
          : undefined,
    };
  }

  return {
    message: typeof error === "string" ? error : "Unknown Supabase read error.",
  };
}

function getErrorCause(error: unknown) {
  if (!(error instanceof Error) || !error.cause || typeof error.cause !== "object") {
    return null;
  }

  return error.cause as Record<string, unknown>;
}

function isRetryableReadError(error: RuntimeReadError | null) {
  if (!error) {
    return false;
  }

  if (error.code && RETRYABLE_CODES.has(error.code)) {
    return true;
  }

  const haystack = [error.name, error.message, error.code, error.details, error.hint]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ");

  return RETRYABLE_PATTERNS.some((pattern) => pattern.test(haystack));
}

function logSupabaseReadAttempt(input: {
  trace?: RuntimePerfTrace;
  step: string;
  attempt: number;
  maxAttempts: number;
  timeoutMs: number;
  durationMs: number;
  ok: boolean;
  retrying: boolean;
  attemptsExhausted: boolean;
  error: RuntimeReadError | null;
}) {
  const payload = {
    request_id: input.trace?.requestId ?? null,
    segment: input.step,
    attempt: input.attempt,
    max_attempts: input.maxAttempts,
    timeout_ms: input.timeoutMs,
    duration_ms: roundMs(input.durationMs),
    ok: input.ok,
    retrying: input.retrying,
    attempts_exhausted: input.attemptsExhausted,
    error_name: input.error?.name ?? null,
    error_message: input.error?.message ?? null,
    error_code: input.error?.code ?? null,
  };

  const serialized = JSON.stringify(payload);
  if (input.ok) {
    console.info(`[retail-pos][runtime][supabase-read] ${serialized}`);
    return;
  }

  console.warn(`[retail-pos][runtime][supabase-read] ${serialized}`);
}

export async function runSupabaseReadWithRetry<T>(
  input: RuntimeReadRetryInput<T>,
): Promise<RuntimeReadResult<T>> {
  const maxAttempts = Math.max(1, Math.min(input.maxAttempts ?? 3, 3));
  const timeoutMs = Math.max(1000, Math.min(input.timeoutMs ?? 3000, 3500));
  let lastResult: RuntimeReadResult<T> | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = nowMs();

    try {
      const result = await input.query(controller.signal);
      const durationMs = nowMs() - startedAt;
      input.trace?.addDuration(input.step, durationMs);
      input.trace?.addDuration(`${input.step}_attempt_${attempt}`, durationMs);
      input.trace?.recordSupabaseDuration(durationMs);
      lastResult = result;

      if (!result.error) {
        logSupabaseReadAttempt({
          trace: input.trace,
          step: input.step,
          attempt,
          maxAttempts,
          timeoutMs,
          durationMs,
          ok: true,
          retrying: false,
          attemptsExhausted: false,
          error: null,
        });
        return result;
      }

      const retryable = isRetryableReadError(result.error);
      const retrying = retryable && attempt < maxAttempts;
      logSupabaseReadAttempt({
        trace: input.trace,
        step: input.step,
        attempt,
        maxAttempts,
        timeoutMs,
        durationMs,
        ok: false,
        retrying,
        attemptsExhausted: retryable && attempt === maxAttempts,
        error: result.error,
      });

      if (!retrying) {
        return result;
      }

      await sleep(getBackoffMs(attempt));
    } catch (error) {
      const normalizedError = normalizeThrownError(error);
      const cause = getErrorCause(error);
      if (cause) {
        normalizedError.code =
          normalizedError.code ??
          (typeof cause.code === "string" ? cause.code : undefined);
      }

      const durationMs = nowMs() - startedAt;
      input.trace?.addDuration(input.step, durationMs);
      input.trace?.addDuration(`${input.step}_attempt_${attempt}`, durationMs);
      input.trace?.recordSupabaseDuration(durationMs);

      const retryable = isRetryableReadError(normalizedError);
      const retrying = retryable && attempt < maxAttempts;
      logSupabaseReadAttempt({
        trace: input.trace,
        step: input.step,
        attempt,
        maxAttempts,
        timeoutMs,
        durationMs,
        ok: false,
        retrying,
        attemptsExhausted: retryable && attempt === maxAttempts,
        error: normalizedError,
      });

      lastResult = {
        data: null,
        error: normalizedError,
      };

      if (!retrying) {
        return lastResult;
      }

      await sleep(getBackoffMs(attempt));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return (
    lastResult ?? {
      data: null,
      error: { message: "Unknown Supabase read error." },
    }
  );
}
