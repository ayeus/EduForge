"use client";

import { useState } from "react";
import { Check, Link2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CertificateActions({ linkedInUrl }: { linkedInUrl: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap justify-center gap-2 print:hidden">
      <Button onClick={() => window.print()} className="bg-heat font-semibold">
        <Printer /> Print or save as PDF
      </Button>
      <Button
        variant="outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {}
        }}
      >
        {copied ? <Check className="text-emerald-400" /> : <Link2 />} {copied ? "Link copied" : "Copy link"}
      </Button>
      <Button asChild variant="outline">
        <a href={linkedInUrl} target="_blank" rel="noopener noreferrer">Add to LinkedIn</a>
      </Button>
    </div>
  );
}
