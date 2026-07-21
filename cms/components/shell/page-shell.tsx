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
    <section className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">
            Forex Bot CMS
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 max-w-3xl text-sm text-zinc-500">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      <Separator />
      {children}
    </section>
  );
}
