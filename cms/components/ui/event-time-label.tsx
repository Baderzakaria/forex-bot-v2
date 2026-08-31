"use client";

import { useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";
import { formatDateTimeLocal, formatDateTimeUtc, formatRelativeTime } from "@/lib/format";

const subscribe = () => () => {};

function useMounted() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

export function EventTimeLabel({
  value,
  className,
}: {
  value?: string | null;
  className?: string;
}) {
  const mounted = useMounted();
  const localLabel = mounted ? formatDateTimeLocal(value) : "—";
  const utcLabel = formatDateTimeUtc(value);

  return (
    <div className={cn("space-y-0.5 text-sm text-[var(--fx-text-soft)]", className)}>
      <div className="font-medium text-[var(--fx-text-strong)]">Local: {localLabel}</div>
      <div className="text-xs leading-5 text-[var(--fx-text-muted)]">UTC: {utcLabel}</div>
    </div>
  );
}

export function EventRelativeTimeLabel({
  value,
  nowIso,
  className,
}: {
  value?: string | null;
  nowIso: string;
  className?: string;
}) {
  return (
    <div className={cn("text-xs font-medium text-[var(--fx-text-muted)]", className)}>
      {formatRelativeTime(value, nowIso)}
    </div>
  );
}

export function NowClock({
  nowIso,
  className,
}: {
  nowIso: string;
  className?: string;
}) {
  const mounted = useMounted();
  const label = mounted ? formatDateTimeLocal(nowIso) : formatDateTimeUtc(nowIso);
  const utcLabel = formatDateTimeUtc(nowIso);

  return (
    <div className={cn("text-sm font-medium text-[var(--fx-text-soft)]", className)}>
      {mounted ? `Now: ${label} · ${utcLabel}` : `Now: ${utcLabel}`}
    </div>
  );
}
