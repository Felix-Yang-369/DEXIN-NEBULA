import "server-only";

type SafeLogValue = string | number | boolean | null | undefined;

const sensitiveField = /^(authorization|cookie|password|secret|token|content|prompt|message|query|queryText)$/i;

export function createServerTimer() {
  const startedAt = process.hrtime.bigint();
  return () => Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}

export function logServerEvent(
  event: string,
  fields: Record<string, SafeLogValue>,
  level: "info" | "warn" | "error" = "info",
) {
  const safeFields = Object.fromEntries(
    Object.entries(fields)
      .filter(([key, value]) => !sensitiveField.test(key) && value !== undefined)
      .map(([key, value]) => [
        key,
        typeof value === "string" ? value.slice(0, 240) : value,
      ]),
  );

  console[level](
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      event: event.slice(0, 80),
      ...safeFields,
    }),
  );
}
