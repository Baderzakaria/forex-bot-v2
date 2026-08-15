import { LockKeyhole } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSafeReturnPath } from "@/lib/auth-session";
import { SignInForm } from "./sign-in-form";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const params = await searchParams;
  const returnTo = getSafeReturnPath(params.returnTo);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md border-[color:rgba(22,49,68,0.14)] bg-[rgba(255,255,255,0.88)] shadow-[var(--fx-shadow-float)]">
        <CardHeader className="space-y-4 p-7 pb-2">
          <div className="flex size-11 items-center justify-center rounded-[18px] bg-[var(--fx-ops-ink)] text-[var(--fx-sage)] shadow-[0_12px_24px_rgba(22,49,68,0.16)]">
            <LockKeyhole className="size-5" aria-hidden="true" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--fx-text-soft)]">Forex Control Room</div>
            <CardTitle className="mt-3 text-3xl font-medium tracking-[-0.04em]">Sign in</CardTitle>
            <p className="mt-2 text-sm leading-6 text-[var(--fx-text-soft)]">
              Use the configured CMS administrator credentials to continue.
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-7 pt-6">
          <SignInForm returnTo={returnTo} />
        </CardContent>
      </Card>
    </div>
  );
}
