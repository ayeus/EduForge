import Link from "next/link";
import { ForgeRing } from "@/components/forge-ring";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-6">
      <div className="text-center">
        <ForgeRing value={0} size={120} stroke={6} label="Not found">
          <span className="font-display text-2xl">404</span>
        </ForgeRing>
        <h1 className="mt-6 font-display text-2xl font-semibold">This page doesn&apos;t exist</h1>
        <p className="mt-2 text-muted-foreground">The link may be old, or the course may have been unpublished.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild variant="outline"><Link href="/courses">Browse courses</Link></Button>
          <Button asChild className="bg-heat font-semibold"><Link href="/">Go home</Link></Button>
        </div>
      </div>
    </main>
  );
}
