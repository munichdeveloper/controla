// Same mark as controla.dev: a frame with crosshair ticks and a status dot.
export default function BrandMark({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className={className}>
      <rect x="1.5" y="1.5" width="25" height="25" rx="7" stroke="currentColor" strokeWidth="2" />
      <circle cx="14" cy="14" r="3.5" className="fill-emerald-600 dark:fill-emerald-400" />
      <path
        d="M14 4.5v4M14 19.5v4M4.5 14h4M19.5 14h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
