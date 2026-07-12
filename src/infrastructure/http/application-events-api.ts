type HeaderValue = string | string[] | undefined;

export function isApplicationEventsAuthorized(headers: Record<string, HeaderValue>): boolean {
  const expected = process.env.LOGS_API_KEY ?? process.env.API_KEY;
  if (!expected) return false;
  const authorization = headers.authorization;
  const actual = Array.isArray(authorization) ? authorization[0] : authorization;
  return actual === `Bearer ${expected}`;
}

export function parseApplicationEventsLimit(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw ?? 100);
  if (!Number.isInteger(parsed)) return 100;
  return Math.min(500, Math.max(1, parsed));
}
