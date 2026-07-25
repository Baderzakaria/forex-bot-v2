const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Parse SQLite/ISO timestamps as UTC so SSR and browser never disagree. */
function parseUtcDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Already has timezone (Z or ±HH:MM)
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(trimmed)) {
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS" → force UTC
  const normalized = trimmed.includes("T")
    ? trimmed
    : trimmed.replace(" ", "T");
  const withZ = /T\d{2}:\d{2}/.test(normalized) ? `${normalized}Z` : `${normalized}T00:00:00Z`;
  const date = new Date(withZ);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatUtcMonthDayYear(date: Date) {
  const month = MONTHS[date.getUTCMonth()];
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();
  return `${month} ${day}, ${year}`;
}

function formatUtcHourMinute(date: Date) {
  const hours = date.getUTCHours();
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes} ${period}`;
}

function resolveNowMs(now: string | number | Date) {
  if (typeof now === "number") return now;
  if (now instanceof Date) return now.getTime();
  const parsed = new Date(now).getTime();
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

export function formatDateTimeUtc(value?: string | null) {
  if (!value) return "—";
  const date = parseUtcDate(value);
  if (!date) return value;
  return `${formatUtcMonthDayYear(date)}, ${formatUtcHourMinute(date)} UTC`;
}

export function formatDateTimeLocal(value?: string | null) {
  if (!value) return "—";
  const date = parseUtcDate(value);
  if (!date) return value;

  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });

  const parts = formatter.formatToParts(date);
  const timeZoneName = parts.find((part) => part.type === "timeZoneName")?.value;
  const formatted = parts
    .filter((part) => part.type !== "timeZoneName")
    .map((part) => part.value)
    .join("")
    .trim();

  return timeZoneName ? `${formatted} (${timeZoneName})` : formatted;
}

export function formatRelativeTime(value?: string | null, now: string | number | Date = Date.now()) {
  if (!value) return "—";
  const date = parseUtcDate(value);
  if (!date) return value;

  const nowMs = resolveNowMs(now);
  const diffMs = date.getTime() - nowMs;
  const absMs = Math.abs(diffMs);
  const direction = diffMs >= 0 ? "in" : "ago";

  if (absMs < 45_000) {
    return "now";
  }

  const minutes = Math.max(1, Math.round(absMs / 60_000));
  if (minutes < 90) {
    return direction === "in" ? `in ${minutes}m` : `${minutes}m ago`;
  }

  const hours = Math.max(1, Math.round(absMs / 3_600_000));
  if (hours < 36) {
    return direction === "in" ? `in ${hours}h` : `${hours}h ago`;
  }

  const days = Math.max(1, Math.round(absMs / 86_400_000));
  return direction === "in" ? `in ${days}d` : `${days}d ago`;
}

export function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = parseUtcDate(value);
  if (!date) return value;
  return `${formatUtcMonthDayYear(date)}, ${formatUtcHourMinute(date)}`;
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = parseUtcDate(value);
  if (!date) return value;
  return formatUtcMonthDayYear(date);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function clampText(value: string | null | undefined, max = 120) {
  const text = value?.trim() || "—";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
