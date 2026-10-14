"use client";

import { useId, useRef, useState } from "react";
import { CheckCircle2, UploadCloud, X } from "lucide-react";
import { HeatBar } from "@/components/forge-ring";
import { Button } from "@/components/ui/button";
import { useUpload, type UploadKind, type UploadState } from "@/hooks/use-upload";
import { cn } from "@/lib/utils";

const ACCEPT: Record<UploadKind, string> = {
  video: "video/mp4,video/webm,video/ogg,video/quicktime",
  attachment: ".pdf,.ppt,.pptx,.doc,.docx,.xlsx,.zip,.txt,.md,.csv",
  cover: "image/png,image/jpeg,image/webp,image/avif",
};

const HINT: Record<UploadKind, string> = {
  video: "MP4, WebM or MOV · up to 2 GB",
  attachment: "PDF, slides, docs, ZIP · up to 100 MB",
  cover: "PNG, JPEG or WebP · up to 5 MB · 16:9 works best",
};

export function FileDrop({
  courseId,
  kind,
  label,
  current,
  onUploaded,
  onBusyChange,
}: {
  courseId: string;
  kind: UploadKind;
  label: string;
  current?: string | null;
  onUploaded: (result: Extract<UploadState, { status: "done" }>) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { state, upload, cancel, reset } = useUpload(courseId, kind);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const handle = async (file: File | undefined) => {
    if (!file) return;
    onBusyChange?.(true);
    const res = await upload(file);
    onBusyChange?.(false);
    if (res?.status === "done") onUploaded(res);
  };

  return (
    <div>
      <div className="mb-2 text-sm font-medium" id={`${id}-label`}>{label}</div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void handle(e.dataTransfer.files[0]);
        }}
        className={cn(
          "rounded-xl border border-dashed p-4 transition-colors",
          over ? "border-ember bg-ember/5" : "border-input",
        )}
      >
        {state.status === "uploading" ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate">{state.name}</span>
              <span className="font-mono text-xs tabular-nums">{Math.round(state.progress * 100)}%</span>
              <Button type="button" size="icon-sm" variant="ghost" onClick={cancel} aria-label="Cancel upload"><X /></Button>
            </div>
            <HeatBar value={state.progress * 100} />
          </div>
        ) : state.status === "done" ? (
          <div className="flex items-center gap-3 text-sm">
            <CheckCircle2 className="size-4 text-ember" />
            <span className="min-w-0 flex-1 truncate">{state.name}</span>
            <Button type="button" size="sm" variant="ghost" onClick={() => { reset(); inputRef.current?.click(); }}>Replace</Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <UploadCloud className="size-5 text-muted-foreground" />
            <div className="min-w-0 flex-1 text-sm">
              {current ? <span className="text-foreground">{current}</span> : <span className="text-muted-foreground">Drop a file here or browse</span>}
              <div className="text-xs text-muted-foreground">{HINT[kind]}</div>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
              {current ? "Replace" : "Browse"}
            </Button>
          </div>
        )}
        {state.status === "error" && <p className="mt-2 text-sm text-destructive" role="alert">{state.message}</p>}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT[kind]}
          className="sr-only"
          aria-labelledby={`${id}-label`}
          tabIndex={-1}
          onChange={(e) => {
            void handle(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
