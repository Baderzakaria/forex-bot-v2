export type EventRow = {
  event_key: string;
  title: string | null;
  currency: string | null;
  country_code: string | null;
  event_time_utc: string | null;
  importance: string | null;
  forecast: string | null;
  previous: string | null;
  actual: string | null;
};

export type RailView = "day" | "upcoming" | "previous";

export type EventAlertStageStatus = "upcoming" | "due" | "missed" | "past" | "sent" | "none";

export type EventAlertStageMeta = {
  status: EventAlertStageStatus;
  atLabel?: string;
  mins?: number;
};

export type EventAlertMeta = {
  t30: EventAlertStageMeta;
  t0: EventAlertStageMeta;
  actual?: EventAlertStageMeta;
  sentAny: boolean;
};

export function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toDayKey(value: string | null | undefined) {
  const date = parseDate(value);
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function getEventTime(value: string | null | undefined) {
  const date = parseDate(value);
  return date ? date.getTime() : null;
}

export function normalizeDayKey(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

export function normalizeMonthKey(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}$/.test(trimmed)) return null;
  const month = Number(trimmed.slice(5, 7));
  return month >= 1 && month <= 12 ? trimmed : null;
}

export function monthKeyFromDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthCursorFromKey(value: string | null | undefined, fallback = new Date()) {
  const monthKey = normalizeMonthKey(value);
  if (!monthKey) {
    return new Date(Date.UTC(fallback.getUTCFullYear(), fallback.getUTCMonth(), 1));
  }

  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7)) - 1;
  return new Date(Date.UTC(year, month, 1));
}

export function normalizeRailView(value: string | null | undefined): RailView {
  return value === "upcoming" || value === "previous" ? value : "day";
}
