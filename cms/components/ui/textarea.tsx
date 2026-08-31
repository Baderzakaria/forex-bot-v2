import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "flex min-h-24 w-full rounded-[18px] border border-[color:var(--fx-border-soft)] bg-[var(--fx-white)] px-3 py-2 text-sm text-[var(--fx-text-strong)] outline-none transition placeholder:text-[var(--fx-text-muted)] focus:border-[color:var(--fx-ops-ink)] focus:ring-2 focus:ring-[rgba(22,49,68,0.12)] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
