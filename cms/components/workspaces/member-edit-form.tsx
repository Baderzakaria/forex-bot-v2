"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type MemberForEdit = {
  id: number;
  email: string | null;
  telegram_username: string;
  website_customer_code: string | null;
  plan: string;
  status: "pending" | "active";
  comments: string | null;
};

type UpdateMemberResponse = {
  ok?: boolean;
  error?: string;
};

export function MemberEditForm({ member }: { member: MemberForEdit }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function updateMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const websiteCustomerCode = String(formData.get("website_customer_code") || "").trim();

    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(formData.get("email") || ""),
          telegram_username: String(formData.get("telegram_username") || ""),
          // Omitting a blank code preserves an existing identity; a non-empty code is still editable.
          website_customer_code: websiteCustomerCode || undefined,
          plan: String(formData.get("plan") || ""),
          status: String(formData.get("status") || ""),
          comments: String(formData.get("comments") || ""),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as UpdateMemberResponse;
      if (!response.ok || !data.ok) {
        throw new Error(response.status === 401 ? "Your CMS session has expired. Sign in again and retry." : data.error || "Unable to update member.");
      }

      setOpen(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update member.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => { setMessage(""); setOpen(true); }}>
        Edit
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(22,49,68,0.32)] p-4" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`edit-member-${member.id}`}
            className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-[24px] border border-[var(--fx-border-soft)] bg-[var(--fx-white)] shadow-[0_24px_80px_rgba(22,49,68,0.28)]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--fx-border-soft)] px-5 py-4">
              <div>
                <h2 id={`edit-member-${member.id}`} className="text-base font-semibold text-[var(--fx-text-strong)]">Edit member</h2>
                <p className="mt-1 text-sm text-[var(--fx-text-soft)]">Update member details and internal notes.</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={saving}>Close</Button>
            </div>
            <form className="grid gap-4 p-5 md:grid-cols-2" onSubmit={updateMember}>
              <div className="space-y-2">
                <Label htmlFor={`edit-member-email-${member.id}`}>Email</Label>
                <Input id={`edit-member-email-${member.id}`} name="email" type="email" defaultValue={member.email || ""} autoComplete="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`edit-member-telegram-${member.id}`}>Telegram</Label>
                <Input id={`edit-member-telegram-${member.id}`} name="telegram_username" defaultValue={member.telegram_username} autoComplete="off" />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`edit-member-code-${member.id}`}>Website customer code</Label>
                <Input id={`edit-member-code-${member.id}`} name="website_customer_code" defaultValue={member.website_customer_code || ""} autoComplete="off" />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`edit-member-plan-${member.id}`}>Plan</Label>
                <Input id={`edit-member-plan-${member.id}`} name="plan" defaultValue={member.plan} list="member-plan-options" />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`edit-member-status-${member.id}`}>Status</Label>
                <select
                  id={`edit-member-status-${member.id}`}
                  name="status"
                  defaultValue={member.status}
                  className="flex h-10 w-full rounded-[16px] border border-[color:var(--fx-border-soft)] bg-[var(--fx-white)] px-3 text-sm text-[var(--fx-text-strong)] outline-none transition focus:border-[color:var(--fx-ops-ink)] focus:ring-2 focus:ring-[rgba(22,49,68,0.12)]"
                >
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor={`edit-member-comments-${member.id}`}>Notes</Label>
                <Textarea id={`edit-member-comments-${member.id}`} name="comments" defaultValue={member.comments || ""} className="min-h-28" placeholder="Internal notes" />
              </div>
              <div className="flex flex-wrap items-center gap-3 md:col-span-2">
                <Button type="submit" size="lg" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
                {message ? <p className="text-sm text-[var(--fx-danger)]" role="alert">{message}</p> : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
