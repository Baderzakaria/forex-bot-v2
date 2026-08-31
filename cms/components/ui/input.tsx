import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded-[16px] border border-[color:var(--fx-border-soft)] bg-[var(--fx-white)] px-3 text-sm text-[var(--fx-text-strong)] outline-none transition placeholder:text-[var(--fx-text-muted)] focus:border-[color:var(--fx-ops-ink)] focus:ring-2 focus:ring-[rgba(22,49,68,0.12)] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
