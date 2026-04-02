import type { LogEntry, LogLevel, AIProvider } from "@breason/types";

// Structured JSON logger — works with Vercel Logs, stdout, and can be
// wired to Sentry via the SENTRY_DSN env var (future integration point).

function entry(
  level: LogLevel,
  message: string,
  extra?: Partial<Omit<LogEntry, "level" | "message" | "timestamp">>
): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

function emit(log: LogEntry): void {
  // Vercel captures stdout JSON automatically.
  // Swap this line for Sentry.captureException / captureMessage when ready.
  const line = JSON.stringify(log);
  if (log.level === "error") {
    console.error(line);
  } else if (log.level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (msg: string, extra?: Partial<Omit<LogEntry, "level" | "message" | "timestamp">>) =>
    emit(entry("debug", msg, extra)),

  info: (msg: string, extra?: Partial<Omit<LogEntry, "level" | "message" | "timestamp">>) =>
    emit(entry("info", msg, extra)),

  warn: (msg: string, extra?: Partial<Omit<LogEntry, "level" | "message" | "timestamp">>) =>
    emit(entry("warn", msg, extra)),

  error: (msg: string, err?: unknown, extra?: Partial<Omit<LogEntry, "level" | "message" | "timestamp">>) => {
    const errorStr = err instanceof Error
      ? `${err.message}${err.stack ? `\n${err.stack}` : ""}`
      : String(err ?? "");
    emit(entry("error", msg, { ...extra, error: errorStr }));
  },

  aiCall: (opts: {
    provider: AIProvider;
    promptVersion: string;
    latencyMs: number;
    success: boolean;
    tokensUsed?: number;
    requestId?: string;
  }) => {
    const level: LogLevel = opts.success ? "info" : "warn";
    emit(entry(level, opts.success ? "ai.call.success" : "ai.call.failed", {
      provider: opts.provider,
      promptVersion: opts.promptVersion,
      latencyMs: opts.latencyMs,
      tokensUsed: opts.tokensUsed,
      requestId: opts.requestId,
    }));
  },
};
