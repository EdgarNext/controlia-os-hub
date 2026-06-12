import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

type TraceMeta = {
  route: string;
  method: string;
  tenant_slug?: string;
  device_id?: string | null;
  folio?: string | null;
  order_id?: string | null;
};

type ErrorInfo = {
  error_name?: string;
  error_message?: string;
  error_code?: string;
  error_cause_name?: string;
  error_cause_message?: string;
  error_cause_code?: string;
  error_cause_errno?: string;
  error_cause_syscall?: string;
  error_cause_address?: string;
  error_cause_port?: string;
};

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function roundMs(value: number) {
  return Math.round(value * 100) / 100;
}

function extractErrorInfo(error: unknown): ErrorInfo {
  if (!(error instanceof Error)) {
    return {};
  }

  const cause =
    error.cause && typeof error.cause === "object"
      ? (error.cause as Record<string, unknown>)
      : null;

  return {
    error_name: error.name,
    error_message: error.message,
    error_code:
      typeof (error as Error & { code?: unknown }).code === "string"
        ? (error as Error & { code?: string }).code
        : undefined,
    error_cause_name: typeof cause?.name === "string" ? cause.name : undefined,
    error_cause_message:
      typeof cause?.message === "string" ? cause.message : undefined,
    error_cause_code: typeof cause?.code === "string" ? cause.code : undefined,
    error_cause_errno:
      typeof cause?.errno === "string" || typeof cause?.errno === "number"
        ? String(cause.errno)
        : undefined,
    error_cause_syscall:
      typeof cause?.syscall === "string" ? cause.syscall : undefined,
    error_cause_address:
      typeof cause?.address === "string" ? cause.address : undefined,
    error_cause_port:
      typeof cause?.port === "string" || typeof cause?.port === "number"
        ? String(cause.port)
        : undefined,
  };
}

export class RuntimePerfTrace {
  readonly requestId: string;
  readonly meta: TraceMeta;
  private readonly startedAt: number;
  private readonly steps = new Map<string, number>();
  private supabaseCalls = 0;

  constructor(input: { requestId?: string | null; meta: TraceMeta }) {
    this.requestId = input.requestId?.trim() || randomUUID();
    this.meta = input.meta;
    this.startedAt = nowMs();
  }

  measureSync<T>(step: string, fn: () => T): T {
    const stepStartedAt = nowMs();
    try {
      return fn();
    } finally {
      this.addDuration(step, nowMs() - stepStartedAt);
    }
  }

  async measure<T>(step: string, fn: () => Promise<T>): Promise<T> {
    const stepStartedAt = nowMs();
    try {
      return await fn();
    } finally {
      this.addDuration(step, nowMs() - stepStartedAt);
    }
  }

  addDuration(step: string, durationMs: number) {
    this.steps.set(step, roundMs((this.steps.get(step) ?? 0) + durationMs));
  }

  recordSupabaseDuration(durationMs: number) {
    this.supabaseCalls += 1;
    this.addDuration("supabase_total", durationMs);
  }

  getDuration(step: string) {
    return this.steps.get(step);
  }

  totalMs() {
    return roundMs(nowMs() - this.startedAt);
  }

  headers() {
    const timing = Array.from(this.steps.entries())
      .filter(([, duration]) => Number.isFinite(duration) && duration >= 0)
      .map(([name, duration]) => `${name};dur=${duration}`)
      .join(", ");

    return {
      "x-request-id": this.requestId,
      "x-retail-pos-trace-id": this.requestId,
      ...(timing ? { "server-timing": `total;dur=${this.totalMs()}, ${timing}` } : { "server-timing": `total;dur=${this.totalMs()}` }),
    };
  }

  log(input: {
    step: string;
    ok: boolean;
    status?: number;
    slowThresholdMs?: number;
    extra?: Record<string, unknown>;
    error?: unknown;
  }) {
    const totalMs = this.totalMs();
    const payload = {
      request_id: this.requestId,
      ...this.meta,
      step: input.step,
      duration_ms:
        input.step === "route_total"
          ? totalMs
          : this.getDuration(input.step) ?? undefined,
      total_ms: totalMs,
      ok: input.ok,
      status: input.status,
      slow:
        totalMs >= (input.slowThresholdMs ?? 1000) ||
        (typeof this.getDuration(input.step) === "number" &&
          (this.getDuration(input.step) ?? 0) >= (input.slowThresholdMs ?? 1000)),
      supabase_call_count: this.supabaseCalls,
      ...extractErrorInfo(input.error),
      ...(input.extra ?? {}),
    };

    const serialized = JSON.stringify(payload);
    if (input.ok) {
      console.info(`[retail-pos][runtime][perf] ${serialized}`);
      return;
    }

    console.warn(`[retail-pos][runtime][perf] ${serialized}`);
  }
}

export function createRuntimePerfTrace(input: {
  request: NextRequest | Request;
  route: string;
  method: string;
  tenantSlug?: string;
  deviceId?: string | null;
  folio?: string | null;
  orderId?: string | null;
}) {
  const requestId =
    "headers" in input.request
      ? input.request.headers.get("x-request-id")
      : null;

  return new RuntimePerfTrace({
    requestId,
    meta: {
      route: input.route,
      method: input.method,
      tenant_slug: input.tenantSlug,
      device_id: input.deviceId ?? null,
      folio: input.folio ?? null,
      order_id: input.orderId ?? null,
    },
  });
}
