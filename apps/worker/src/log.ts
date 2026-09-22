/**
 * Structured logs for Cloud Logging: one JSON object per line with a
 * `severity` field, so failures show up as ERROR and can drive alert policies.
 * https://cloud.google.com/run/docs/logging#special-fields
 */

type Fields = Record<string, unknown>;

function errorFields(err: unknown): Fields {
  if (err instanceof Error) return { error: err.message, stack: err.stack };
  if (err === undefined) return {};
  return { error: String(err) };
}

function emit(severity: 'INFO' | 'WARNING' | 'ERROR', message: string, fields: Fields): void {
  const line = JSON.stringify({ severity, message: `[worker] ${message}`, ...fields });
  if (severity === 'ERROR') console.error(line);
  else console.log(line);
}

export function logInfo(message: string, fields: Fields = {}): void {
  emit('INFO', message, fields);
}

export function logWarning(message: string, fields: Fields = {}): void {
  emit('WARNING', message, fields);
}

export function logError(message: string, err?: unknown, fields: Fields = {}): void {
  emit('ERROR', message, { ...fields, ...errorFields(err) });
}
