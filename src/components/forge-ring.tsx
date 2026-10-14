import { cn } from "@/lib/utils";

/**
 * The signature progress element. The arc's glow intensifies as completion rises —
 * a cold ring at 0% and a molten one at 100%.
 */
export function ForgeRing({
  value,
  size = 64,
  stroke = 6,
  label,
  className,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const id = `fr-${size}-${stroke}`;
  const glow = 2 + (pct / 100) * 10;
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? "Course progress"}
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--ember)" />
            <stop offset="1" stopColor="var(--ember-hot)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--rule)" strokeWidth={stroke} />
        {pct > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#${id})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct / 100)}
            style={{
              filter: `drop-shadow(0 0 ${glow}px rgb(255 122 47 / ${0.25 + pct / 250}))`,
              transition: "stroke-dashoffset 900ms cubic-bezier(.2,.7,.2,1)",
            }}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        {children ?? <span className="font-mono text-xs tabular-nums">{pct}%</span>}
      </div>
    </div>
  );
}

export function HeatBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-rule", className)} aria-hidden>
      <div
        className="h-full rounded-full bg-heat transition-[width] duration-700"
        style={{ width: `${pct}%`, boxShadow: pct > 0 ? "0 0 12px rgb(255 122 47 / .5)" : undefined }}
      />
    </div>
  );
}
