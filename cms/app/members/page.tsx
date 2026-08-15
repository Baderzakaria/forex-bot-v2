import { connection } from "next/server";

import { PageShell } from "@/components/shell/page-shell";
import { Badge } from "@/components/ui/badge";
import { formatDateTimeUtc } from "@/lib/format";
import { listMembers } from "@/lib/members";

export default async function MembersPage() {
  // SQLite is synchronous, so defer this read until the signed-in request arrives.
  await connection();
  const members = listMembers();

  return (
    <div className="px-4 py-4 lg:px-8 lg:py-6">
      <PageShell title="Members" subtitle="Website checkout signups synced to the CMS.">
        <div className="overflow-hidden rounded-[22px] border border-[var(--fx-border-soft)] bg-[rgba(255,255,255,0.78)]">
          {members.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--fx-border-soft)] bg-[rgba(247,245,240,0.72)] text-xs font-semibold uppercase tracking-[0.14em] text-[var(--fx-text-muted)]">
                  <tr>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Telegram</th>
                    <th className="px-4 py-3">FXIS</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--fx-border-soft)] text-[var(--fx-text-soft)]">
                  {members.map((member) => (
                    <tr key={member.id}>
                      <td className="px-4 py-3 font-medium text-[var(--fx-text-strong)]">{member.email || "—"}</td>
                      <td className="px-4 py-3">{member.telegram_username ? `@${member.telegram_username}` : "—"}</td>
                      <td className="px-4 py-3">{member.website_customer_code || "—"}</td>
                      <td className="px-4 py-3">{member.plan || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge tone={member.status === "active" ? "success" : "muted"}>{member.status}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{formatDateTimeUtc(member.created_at)}</td>
                      <td className="whitespace-nowrap px-4 py-3">{formatDateTimeUtc(member.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-5 py-10 text-center text-sm text-[var(--fx-text-soft)]">
              No website checkout signups have been synced yet.
            </div>
          )}
        </div>
      </PageShell>
    </div>
  );
}
