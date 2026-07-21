"use client";

import { useMemo, useState } from "react";
import Cropper from "react-easy-crop";
import { Upload, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export function MediaStudio({
  title = "Image",
  contextLabel,
  onAttach,
}: {
  title?: string;
  contextLabel?: string;
  onAttach?: (assetLabel: string) => void;
}) {
  const [fileName, setFileName] = useState("");
  const [imageSrc, setImageSrc] = useState("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [status, setStatus] = useState("");

  const preview = useMemo(() => imageSrc || "/vercel.svg", [imageSrc]);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {contextLabel ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Attached to <span className="font-medium">{contextLabel}</span>
            </div>
          ) : null}
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4">
            <Input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setFileName(file.name);
                setImageSrc(URL.createObjectURL(file));
                setStatus(`Loaded ${file.name} locally. Upload persistence is not wired yet.`);
                onAttach?.(file.name);
              }}
            />
            <div className="mt-3 flex items-center gap-2 text-sm text-zinc-500">
              <Upload className="size-4" />
              {fileName || "No file chosen"}
            </div>
            {status ? <div className="mt-2 text-xs text-emerald-700">{status}</div> : null}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-3">
            <div className="relative h-80 overflow-hidden rounded-xl bg-zinc-100">
              <Cropper
                image={preview}
                crop={crop}
                zoom={zoom}
                aspect={16 / 9}
                cropSize={{ width: 320, height: 180 }}
                onCropChange={setCrop}
                onZoomChange={setZoom}
              />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Open source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Unsplash search term" />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setStatus("Source search is a stub for now. Add a backend image search before shipping.");
              }}
            >
              Search sources
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Generate stub</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full"
              onClick={() => {
                setStatus("Generation stub ready for a future image API. Nothing is saved.");
                onAttach?.("generated-image-stub");
              }}
            >
              <Wand2 className="mr-2 size-4" />
              Generate image stub
            </Button>
            <Separator />
            <div className="text-sm text-zinc-500">
              Placeholder for future generation API integration.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
