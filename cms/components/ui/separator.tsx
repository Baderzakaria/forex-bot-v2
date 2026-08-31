import { cn } from "@/lib/utils";

function Separator({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("h-px w-full bg-[var(--fx-border-soft)]", className)} {...props} />;
}

export { Separator };
