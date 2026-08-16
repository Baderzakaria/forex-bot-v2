"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CreateMemberResponse = {
  ok?: boolean;
  error?: string;
};

export function MemberCreateForm({ total }: { total: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);

  async function createMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const optional = (name: string) => String(formData.get(name) || "").trim() || undefined;

    setSaving(true);
    setMessage("");
    setHasError(false);

    try {
      const response = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: optional("email"),
          telegram_username: optional("telegram_username"),
          website_customer_code: optional("website_customer_code"),
          plan: optional("plan"),
          status: optional("status"),
          comments: optional("comments"),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as CreateMemberResponse;

      if (!response.ok || !data.ok) {
        throw new Error(response.status === 401 ? "Your CMS session has expired. Sign in again and retry." : data.error || "Unable to save member.");
      }

      form.reset();
      setOpen(false);
      setMessage("Member saved. The list has been refreshed.");
      router.refresh();
    } catch (error) {
      setHasError(true);
      setMessage(error instanceof Error ? error.message : "Unable to save member.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-b border-[var(--fx-border-soft)] px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--fx-text-strong)]">Members</h2>
          <p className="mt-1 text-sm text-[var(--fx-text-soft)]">{total} member{total === 1 ? "" : "s"} in the CMS</p>
        </div>
        <Button type="button" variant={open ? "outline" : "default"} onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          {open ? "Close" : "Add member"}
        </Button>
      </div>

      {open ? (
        <Card className="mt-4 shadow-none">
          <CardHeader>
            <CardTitle>Add member</CardTitle>
            <CardDescription>Add a member manually when they did not arrive through the website checkout.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" onSubmit={createMember}>
              <div className="space-y-2 xl:col-span-2">
                <Label htmlFor="member-email">Email</Label>
                <Input id="member-email" name="email" type="email" required autoComplete="email" placeholder="member@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="member-telegram">Telegram</Label>
                <Input id="member-telegram" name="telegram_username" placeholder="username" autoComplete="off" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="member-plan">Plan</Label>
                <Input id="member-plan" name="plan" list="member-plan-options" defaultValue="free" placeholder="free" />
                <datalist id="member-plan-options">
                  <option value="free" />
                  <option value="monthly" />
                  <option value="quarterly" />
                  <option value="annual" />
                </datalist>
              </div>
              <div className="space-y-2">
                <Label htmlFor="member-status">Status</Label>
                <select
                  id="member-status"
                  name="status"
                  defaultValue="pending"
                  className="flex h-10 w-full rounded-[16px] border border-[color:var(--fx-border-soft)] bg-[var(--fx-white)] px-3 text-sm text-[var(--fx-text-strong)] outline-none transition focus:border-[color:var(--fx-ops-ink)] focus:ring-2 focus:ring-[rgba(22,49,68,0.12)]"
                >
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2 xl:col-span-3">
                <Label htmlFor="member-code">Website customer code</Label>
                <Input id="member-code" name="website_customer_code" placeholder="Generated automatically when left blank" autoComplete="off" />
              </div>
              <div className="space-y-2 md:col-span-2 xl:col-span-2">
                <Label htmlFor="member-comments">Notes</Label>
                <Textarea id="member-comments" name="comments" placeholder="Optional internal notes" className="min-h-10" />
              </div>
              <div className="flex flex-wrap items-end gap-3 md:col-span-2 xl:col-span-5">
                <Button type="submit" size="lg" disabled={saving}>
                  {saving ? "Adding member…" : "Add member"}
                </Button>
                {message ? (
                  <p className={hasError ? "text-sm text-[var(--fx-danger)]" : "text-sm text-[var(--fx-text-soft)]"} role="status">
                    {message}
                  </p>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>
      ) : message ? (
        <p className={hasError ? "mt-3 text-sm text-[var(--fx-danger)]" : "mt-3 text-sm text-[var(--fx-text-soft)]"} role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
