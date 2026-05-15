import * as Sentry from "@sentry/nextjs";

export function captureApiError(error: unknown, context: Record<string, string | number | boolean | null>) {
  console.error("[API Error]", context, error);
  Sentry.captureException(error, { extra: context });
}
