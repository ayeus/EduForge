import { Logo } from "@/components/logo";
import { ForgeRing } from "@/components/forge-ring";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main id="main" className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="flex flex-1 items-center py-12">
          <div className="mx-auto w-full max-w-sm">{children}</div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden border-l border-border bg-[var(--steel)] lg:block" aria-hidden>
        <div className="absolute inset-0 bg-blueprint" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_55%,rgb(255_122_47/.16),transparent)]" />
        <div className="absolute inset-0 grid place-items-center">
          <div className="relative grid place-items-center">
            <ForgeRing value={100} size={360} stroke={2} className="absolute opacity-25" label="decorative" />
            <ForgeRing value={72} size={280} stroke={10} className="[&_svg]:animate-[forge-spin_60s_linear_infinite]" label="decorative">
              <div className="text-center">
                <div className="font-display text-5xl font-semibold text-heat">72%</div>
                <div className="mt-2 text-sm text-muted-foreground">of the way to a new skill</div>
              </div>
            </ForgeRing>
          </div>
        </div>
      </div>
    </main>
  );
}
