import { cn } from "@/lib/utils";

function Badge({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "default" | "success" | "muted" | "warning" }) {
  const tones = {
    default: "border-zinc-200 bg-zinc-50 text-zinc-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    muted: "border-zinc-200 bg-white text-zinc-600",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
