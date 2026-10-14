import { Logo } from "@/components/logo";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/70">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Logo />
        <p>Built for people who learn by doing. © {new Date().getFullYear()} EduForge</p>
      </div>
    </footer>
  );
}
