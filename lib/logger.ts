// Structured JSON logging. One line per event on stdout, which is what
// every log aggregator (Datadog, Better Stack, CloudWatch, Grafana Loki,
// Railway/Vercel's own drains) expects — `console.log("thing happened")`
// is unsearchable once there is real traffic.
//
// No transport or vendor SDK here on purpose: the platform you deploy to
// collects stdout already, so this stays dependency-free and works the
// same locally, in CI and in production.

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

// LOG_LEVEL lets you turn debug on in one environment without a deploy.
const MIN_LEVEL = LEVELS[(process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === "production" ? "info" : "debug")] ?? 20;

// Anything whose key looks secret is replaced before it can reach a log
// aggregator, where it would then be searchable and retained for months.
const REDACT_KEYS = /pass|secret|token|authorization|cookie|apikey|api_key|vapid|jwt|hash/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACT_KEYS.test(k) ? "[redacted]" : redact(v, depth + 1);
  }
  return out;
}

function emit(level: LogLevel, message: string, context?: Record<string, unknown>) {
  if (LEVELS[level] < MIN_LEVEL) return;
  const line = {
    level,
    message,
    time: new Date().toISOString(),
    ...(context ? (redact(context) as Record<string, unknown>) : {}),
  };
  // Errors and warnings to stderr so platforms that split streams classify
  // them correctly without extra configuration.
  const out = level === "error" || level === "warn" ? console.error : console.log;
  out(JSON.stringify(line));
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => emit("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => emit("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => emit("error", message, context),
};

/** Normalises a thrown value into something safe to log. */
export function describeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { errorName: error.name, errorMessage: error.message, stack: error.stack };
  }
  return { errorMessage: String(error) };
}
