export function Gauge({ label, value }: { label: string; value: number | null }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const color =
    value === null
      ? "var(--muted)"
      : value >= 90
        ? "var(--clear)"
        : value >= 50
          ? "var(--review)"
          : "var(--issue)";
  return (
    <figure className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 120 120" className="h-32 w-32" role="img" aria-label={`${label}: ${value ?? "not applicable"}`}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--line)" strokeWidth="8" />
        {value !== null && (
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(value / 100) * c} ${c}`}
            transform="rotate(-90 60 60)"
          />
        )}
        <text x="60" y="68" textAnchor="middle" fontSize="28" fontWeight="600" fill={color}>
          {value ?? "–"}
        </text>
      </svg>
      <figcaption className="text-sm font-medium">{label}</figcaption>
    </figure>
  );
}
