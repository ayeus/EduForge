"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="grid min-h-[60dvh] place-items-center px-6">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl font-semibold">Something broke on our side</h1>
        <p className="mt-2 text-muted-foreground">
          Try again. If it keeps happening, share this reference with support: <code className="font-mono text-xs">{error.digest ?? "n/a"}</code>
        </p>
        <Button className="mt-6 bg-heat font-semibold" onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
