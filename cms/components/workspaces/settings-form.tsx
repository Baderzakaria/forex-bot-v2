"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Settings = {
  sheetUrl: string;
  countries: string;
  daysAhead: string;
};

export function SettingsForm({ initial }: { initial: Settings }) {
  const [settings, setSettings] = useState(initial);
  const [status, setStatus] = useState("");

  async function submit() {
    setStatus("Saving...");
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          google_sheet_url: settings.sheetUrl,
          apify_macro_countries: settings.countries,
          apify_macro_days_ahead: settings.daysAhead,
        }),
      });
      if (!response.ok) throw new Error("Unable to save settings");
      setStatus("Saved");
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Source settings</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="sheetUrl">Legacy Google Sheet URL</Label>
          <p className="text-sm text-zinc-500">
            Optional. CMS is the source of truth; Sheets only matter for legacy workflows.
          </p>
          <Input
            id="sheetUrl"
            value={settings.sheetUrl}
            onChange={(event) => setSettings({ ...settings, sheetUrl: event.target.value })}
            placeholder="Optional legacy sheet URL"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="countries">Countries</Label>
          <Textarea
            id="countries"
            value={settings.countries}
            onChange={(event) => setSettings({ ...settings, countries: event.target.value })}
            placeholder="united states, united kingdom, germany"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="daysAhead">Days ahead</Label>
          <Input
            id="daysAhead"
            value={settings.daysAhead}
            onChange={(event) => setSettings({ ...settings, daysAhead: event.target.value })}
            placeholder="7"
          />
        </div>
        <div className="md:col-span-2 flex items-center justify-between gap-3">
          <span className="text-sm text-zinc-500">{status || "Ready"}</span>
          <Button onClick={submit}>Save settings</Button>
        </div>
      </CardContent>
    </Card>
  );
}
