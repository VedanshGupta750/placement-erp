import { logger, describeError } from "@/lib/logger";

// Next.js instrumentation hooks. `onRequestError` is the framework's single
// chokepoint for uncaught server errors — Server Components, route handlers
// and middleware all funnel through here — so it is the one place that can
// guarantee no production error is lost to an unread container log.
//
// This deliberately ships with no vendor SDK. Everything goes out as
// structured JSON on stderr, which every hosting platform already collects
// and every aggregator can parse. To add Sentry/Datadog later, install the
// SDK, initialise it in `register()`, and forward the same error here —
// nothing else in the app has to change.

export async function register() {
  logger.info("app.started", {
    nodeEnv: process.env.NODE_ENV,
    runtime: process.env.NEXT_RUNTIME,
    version: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.APP_VERSION ?? "unknown",
  });

  // Without these, a rejected promise or a throw outside the request cycle
  // can take the process down leaving nothing behind to explain why.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.on("unhandledRejection", (reason) => {
      logger.error("process.unhandled_rejection", describeError(reason));
    });
    process.on("uncaughtException", (error) => {
      logger.error("process.uncaught_exception", describeError(error));
    });
  }
}

export async function onRequestError(
  error: unknown,
  request: { path: string; method: string; headers: Record<string, string | undefined> },
  context: { routerKind: string; routePath: string; routeType: string },
) {
  logger.error("request.error", {
    ...describeError(error),
    method: request.method,
    path: request.path,
    routePath: context.routePath,
    routeType: context.routeType,
    routerKind: context.routerKind,
    // Identifies the caller for correlation without logging the whole
    // header set, which would drag cookies and auth tokens into the logs.
    userAgent: request.headers["user-agent"],
    requestId: request.headers["x-request-id"] ?? request.headers["x-vercel-id"],
  });

  // Add a vendor here when you pick one, e.g.:
  //   Sentry.captureException(error, { extra: { path: request.path } });
}
