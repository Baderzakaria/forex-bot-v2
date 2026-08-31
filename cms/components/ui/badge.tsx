import { cn } from "@/lib/utils";

function Badge({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "default" | "success" | "muted" | "warning" }) {
  const tones = {
    default: "border-[color:var(--fx-border-soft)] bg-[var(--fx-sage)] text-[var(--fx-ops-ink)]",
    success: "border-transparent bg-[rgba(159,202,90,0.16)] text-[#55712a]",
    muted: "border-[color:var(--fx-border-soft)] bg-[rgba(22,49,68,0.04)] text-[var(--fx-text-soft)]",
    warning: "border-transparent bg-[rgba(217,164,65,0.16)] text-[#8d6621]",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-[0.01em]",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
