type AnyRecord = Record<string, unknown>;

export type EdgeFunctionErrorInfo = {
  code?: string;
  message?: string;
  raw?: unknown;
};

function safeJsonParse(value: unknown): unknown {
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractJsonFromErrorMessage(message: string): unknown {
  // supabase-js often formats like:
  // "Edge function returned 400: Error, {"error":"...","message":"..."}"
  const match = message.match(/(\{[\s\S]*\})\s*$/);
  if (!match) return null;
  return safeJsonParse(match[1]);
}

/**
 * Normalizes error payloads coming from backend function calls.
 * Works when payload is returned as `data`, embedded in `error.context.body`,
 * or embedded at the end of `error.message`.
 */
export function parseEdgeFunctionError(error: unknown, data?: unknown): EdgeFunctionErrorInfo {
  const fromData = data && typeof data === 'object' ? (data as AnyRecord) : null;
  if (fromData?.error || fromData?.message) {
    return {
      code: typeof fromData.error === 'string' ? fromData.error : undefined,
      message:
        (typeof fromData.message === 'string' ? fromData.message : undefined) ||
        (typeof fromData.details === 'string' ? fromData.details : undefined),
      raw: data,
    };
  }

  const errObj = error && typeof error === 'object' ? (error as AnyRecord) : null;

  // Some runtimes may already expose a code directly on the error.
  const directCode = typeof errObj?.error === 'string' ? (errObj.error as string) : undefined;
  const directMessage = typeof errObj?.message === 'string' ? (errObj.message as string) : undefined;

  // supabase-js FunctionsHttpError usually has `context.body`
  const ctx = errObj?.context && typeof errObj.context === 'object' ? (errObj.context as AnyRecord) : null;
  const ctxBody = ctx?.body;
  if (ctxBody && typeof ctxBody === 'object') {
    const bodyObj = ctxBody as AnyRecord;
    return {
      code: typeof bodyObj.error === 'string' ? bodyObj.error : undefined,
      message: typeof bodyObj.message === 'string' ? bodyObj.message : undefined,
      raw: ctxBody,
    };
  }
  if (typeof ctxBody === 'string') {
    const parsed = safeJsonParse(ctxBody);
    if (parsed && typeof parsed === 'object') {
      const bodyObj = parsed as AnyRecord;
      return {
        code: typeof bodyObj.error === 'string' ? bodyObj.error : undefined,
        message: typeof bodyObj.message === 'string' ? bodyObj.message : undefined,
        raw: parsed,
      };
    }
  }

  const msg = typeof errObj?.message === 'string' ? (errObj.message as string) : undefined;
  if (msg) {
    const parsed = extractJsonFromErrorMessage(msg);
    if (parsed && typeof parsed === 'object') {
      const bodyObj = parsed as AnyRecord;
      return {
        code: typeof bodyObj.error === 'string' ? bodyObj.error : undefined,
        message: typeof bodyObj.message === 'string' ? bodyObj.message : undefined,
        raw: parsed,
      };
    }
    return { message: msg, raw: error };
  }

  // Fallback: stringify error and try extracting JSON.
  // (Some environments don't expose `message` but `String(error)` does.)
  try {
    const str = typeof error === 'string' ? error : String(error);
    const parsed = extractJsonFromErrorMessage(str);
    if (parsed && typeof parsed === 'object') {
      const bodyObj = parsed as AnyRecord;
      return {
        code: typeof bodyObj.error === 'string' ? bodyObj.error : directCode,
        message: typeof bodyObj.message === 'string' ? bodyObj.message : directMessage,
        raw: parsed,
      };
    }
    if (directCode || directMessage) return { code: directCode, message: directMessage, raw: error };
  } catch {
    // ignore
  }

  return { raw: error };
}
