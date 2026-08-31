import Link from "next/link";
import { connection } from "next/server";

import { PageShell } from "@/components/shell/page-shell";
import { Badge } from "@/components/ui/badge";
import { MemberCreateForm } from "@/components/workspaces/member-create-form";
import { MemberEditForm } from "@/components/workspaces/member-edit-form";
import { formatDateTimeUtc } from "@/lib/format";
import { listMembers } from "@/lib/members";

type SearchParams = Record<string, string | string[] | undefined>;

const MEMBERS_PER_PAGE = 20;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function pageNumber(value: string | undefined) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

function commentsPreview(comments: string | null) {
  const normalized = comments?.replace(/\s+/g, " ").trim() || "";
  if (!normalized) return "—";
  return normalized.length > 90 ? `${normalized.slice(0, 89)}…` : normalized;
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  // SQLite is synchronous, so defer this read until the signed-in request arrives.
  await connection();
  const params = await Promise.resolve(searchParams ?? {});
  const result = listMembers({ page: pageNumber(firstParam(params.page)), limit: MEMBERS_PER_PAGE });
  const totalPages = Math.max(1, Math.ceil(result.total / result.limit));
  const previousHref = result.page > 1 ? `/members?page=${result.page - 1}` : null;
  const nextHref = result.page < totalPages ? `/members?page=${result.page + 1}` : null;

  return (
    <div className="px-4 py-4 lg:px-8 lg:py-6">
      <PageShell title="Members" subtitle="Website checkout signups synced to the CMS. You can also add and maintain members here manually.">
        <div className="overflow-hidden rounded-[22px] border border-[var(--fx-border-soft)] bg-[rgba(255,255,255,0.78)]">
          <MemberCreateForm total={result.total} />
          {result.members.length ? (
            <div className="w-full max-w-full overflow-x-auto">
              <table className="w-full min-w-[920px] table-fixed text-left text-sm">
                <thead className="border-b border-[var(--fx-border-soft)] bg-[rgba(247,245,240,0.72)] text-xs font-semibold uppercase tracking-[0.14em] text-[var(--fx-text-muted)]">
                  <tr>
                    <th className="w-52 px-3 py-2.5">Email</th>
                    <th className="w-32 px-3 py-2.5">Telegram</th>
                    <th className="w-24 px-3 py-2.5">FXIS</th>
                    <th className="w-24 px-3 py-2.5">Plan</th>
                    <th className="w-24 px-3 py-2.5">Status</th>
                    <th className="w-44 px-3 py-2.5">Notes</th>
                    <th className="w-24 px-3 py-2.5">Source</th>
                    <th className="w-36 px-3 py-2.5">Created</th>
                    <th className="w-36 px-3 py-2.5">Updated</th>
                    <th className="w-20 px-3 py-2.5"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--fx-border-soft)] text-[var(--fx-text-soft)]">
                  {result.members.map((member) => (
                    <tr key={member.id}>
                      <td className="px-3 py-2.5 font-medium text-[var(--fx-text-strong)]">
                        <div className="truncate" title={member.email || undefined}>{member.email || "—"}</div>
                      </td>
                      <td className="px-3 py-2.5"><div className="truncate">{member.telegram_username ? `@${member.telegram_username}` : "—"}</div></td>
                      <td className="px-3 py-2.5"><div className="truncate">{member.website_customer_code || "—"}</div></td>
                      <td className="px-3 py-2.5"><div className="truncate">{member.plan || "—"}</div></td>
                      <td className="px-3 py-2.5">
                        <Badge tone={member.status === "active" ? "success" : "muted"}>{member.status}</Badge>
                      </td>
                      <td className="px-3 py-2.5" title={member.comments || undefined}><div className="truncate">{commentsPreview(member.comments)}</div></td>
                      <td className="px-3 py-2.5"><div className="truncate">{member.source || "—"}</div></td>
                      <td className="whitespace-nowrap px-3 py-2.5">{formatDateTimeUtc(member.created_at)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{formatDateTimeUtc(member.updated_at)}</td>
                      <td className="px-3 py-2.5"><MemberEditForm member={member} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-5 py-10 text-center text-sm text-[var(--fx-text-soft)]">
              No members yet. Add one with the button above or wait for a website checkout signup to sync.
            </div>
          )}
          {totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--fx-border-soft)] px-4 py-3 sm:px-5">
              <p className="text-sm text-[var(--fx-text-soft)]">Page {result.page} of {totalPages}</p>
              <div className="flex items-center gap-2">
                {previousHref ? (
                  <Link className="inline-flex h-8 items-center rounded-[14px] border border-[var(--fx-border-soft)] bg-[var(--fx-white)] px-2.5 text-sm font-medium text-[var(--fx-text-strong)] transition hover:border-[var(--fx-border-strong)] hover:bg-[var(--fx-sage)]" href={previousHref}>Previous</Link>
                ) : (
                  <span className="inline-flex h-8 items-center rounded-[14px] border border-[var(--fx-border-soft)] px-2.5 text-sm font-medium text-[var(--fx-text-muted)] opacity-60">Previous</span>
                )}
                {nextHref ? (
                  <Link className="inline-flex h-8 items-center rounded-[14px] border border-[var(--fx-border-soft)] bg-[var(--fx-white)] px-2.5 text-sm font-medium text-[var(--fx-text-strong)] transition hover:border-[var(--fx-border-strong)] hover:bg-[var(--fx-sage)]" href={nextHref}>Next</Link>
                ) : (
                  <span className="inline-flex h-8 items-center rounded-[14px] border border-[var(--fx-border-soft)] px-2.5 text-sm font-medium text-[var(--fx-text-muted)] opacity-60">Next</span>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </PageShell>
    </div>
  );
}
