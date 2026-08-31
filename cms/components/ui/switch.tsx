import { cn } from "@/lib/utils";

function Switch({
  checked = false,
  onCheckedChange,
  className,
}: {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        "inline-flex h-6 w-11 items-center rounded-full border border-[color:var(--fx-border-soft)] p-0.5 transition",
        checked ? "bg-[var(--fx-ops-ink)]" : "bg-[rgba(22,49,68,0.12)]",
        className
      )}
    >
      <span
        className={cn(
          "h-5 w-5 rounded-full bg-[var(--fx-white)] shadow-sm transition",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

export { Switch };
