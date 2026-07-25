import { Separator } from "@/components/ui/separator";

export function PageShell({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-4xl">
          <div className="inline-flex items-center rounded-full border border-[var(--fx-border-soft)] bg-[rgba(255,255,255,0.7)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--fx-text-soft)]">
            Forex Control Room
          </div>
          <h1 className="mt-4 text-[clamp(2rem,3vw,3.5rem)] font-medium tracking-[-0.04em] text-[var(--fx-text-strong)]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 max-w-3xl text-base leading-7 text-[var(--fx-text-soft)]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <Separator />
      {children}
    </section>
  );
}
