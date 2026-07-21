import Link from "next/link";

import { PageShell } from "@/components/shell/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MediaPage() {
  return (
    <div className="px-4 py-4 lg:px-8 lg:py-6">
      <PageShell
        title="Media"
        subtitle="Media is a local preview workspace for now. Use Content for post-bound attachments."
      >
        <Card>
          <CardHeader>
            <CardTitle>Local preview only</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-zinc-600">
            <p>
              The image workflow is embedded in the content editor so assets stay attached to the
              current post. This page is a lightweight reminder that a real upload backend is not
              wired yet.
            </p>
            <Link
              href="/content"
              className="inline-flex h-8 items-center justify-center rounded-lg bg-zinc-950 px-3 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              Open Content
            </Link>
          </CardContent>
        </Card>
      </PageShell>
    </div>
  );
}
