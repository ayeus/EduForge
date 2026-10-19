import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CertificateActions } from "@/components/certificate-actions";
import { ForgeRing } from "@/components/forge-ring";
import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/lib/auth/dal";
import { getCertificate } from "@/lib/data/engagement";
import { LEVEL_LABEL, duration } from "@/lib/format";

async function load(id: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  const cert = await getCertificate(id);
  if (!cert) notFound();
  return cert;
}

export async function generateMetadata({ params }: PageProps<"/certificates/[id]">): Promise<Metadata> {
  const { id } = await params;
  const cert = await load(id);
  return {
    title: `Certificate · ${cert.courseTitle}`,
    description: `${cert.studentName} completed ${cert.courseTitle} on EduForge.`,
    robots: { index: false },
  };
}

const dateFmt = new Intl.DateTimeFormat("en", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

export default async function CertificatePage({ params }: PageProps<"/certificates/[id]">) {
  const { id } = await params;
  const [cert, viewer, h] = await Promise.all([load(id), getCurrentUser(), headers()]);
  const owner = viewer?.id === cert.userId;
  const origin = process.env.NEXT_PUBLIC_SITE_URL || `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const url = `${origin}/certificates/${cert.id}`;
  const issued = cert.issuedAt;
  const linkedIn = new URL("https://www.linkedin.com/profile/add");
  linkedIn.search = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: cert.courseTitle,
    organizationName: "EduForge",
    issueYear: String(issued.getUTCFullYear()),
    issueMonth: String(issued.getUTCMonth() + 1),
    certUrl: url,
    certId: cert.id,
  }).toString();
  const hours = duration(cert.totalSeconds);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 print:max-w-none print:p-0">
      <article
        className="certificate relative overflow-hidden rounded-3xl border border-border bg-card p-8 sm:p-14 print:rounded-none print:border-0"
        aria-label={`Certificate of completion for ${cert.studentName}`}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-heat" aria-hidden />
        <div className="pointer-events-none absolute inset-0 bg-blueprint opacity-60 print:hidden" aria-hidden />
        <div className="pointer-events-none absolute -top-40 -right-40 size-[28rem] rounded-full bg-[radial-gradient(circle,rgb(255_122_47/0.16),transparent_65%)] print:hidden" aria-hidden />

        <div className="relative">
          <div className="flex items-start justify-between gap-6">
            <Logo />
            <ForgeRing value={100} size={84} stroke={7} label="Course complete">
              <span className="font-mono text-xs">100%</span>
            </ForgeRing>
          </div>

          <p className="mt-12 text-sm text-muted-foreground">Certificate of completion</p>
          <h1 className="mt-3 font-display text-[clamp(2rem,6vw,3.6rem)] leading-[1.05] font-semibold text-balance">{cert.studentName}</h1>
          <p className="mt-6 max-w-[48ch] text-lg text-muted-foreground">
            completed every lesson of <span className="text-foreground">{cert.courseTitle}</span>
            {cert.instructorName ? <>, taught by {cert.instructorName}</> : null}.
          </p>

          <dl className="mt-12 grid grid-cols-2 gap-6 border-t border-border pt-6 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Issued</dt>
              <dd className="mt-1">{dateFmt.format(issued)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Lessons</dt>
              <dd className="mt-1 font-mono tabular-nums">{cert.lessonCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{hours ? "Video" : "Level"}</dt>
              <dd className="mt-1">{hours ?? LEVEL_LABEL[cert.courseLevel]}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Credential ID</dt>
              <dd className="mt-1 truncate font-mono text-xs" title={cert.id}>{cert.id.slice(0, 8)}</dd>
            </div>
          </dl>
          <p className="mt-6 text-xs break-all text-muted-foreground">Verify at {url}</p>
        </div>
      </article>

      <div className="mt-8 space-y-4 text-center print:hidden">
        {owner ? (
          <CertificateActions linkedInUrl={linkedIn.toString()} />
        ) : (
          <p className="text-sm text-muted-foreground">
            This certificate was issued by EduForge to {cert.studentName}.{" "}
            <Link href={`/courses/${cert.courseId}`} className="text-foreground underline underline-offset-4">See the course</Link>
          </p>
        )}
      </div>
    </div>
  );
}
