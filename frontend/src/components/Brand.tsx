// Controla word mark, identical to the one on controla.dev
// (nim-landing-page components/Brand.tsx).
export function Brand({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 font-display text-xl font-semibold tracking-tight text-foreground ${className}`}>
      <svg width="27" height="27" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <rect x="2" y="2" width="24" height="24" rx="7" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="14" cy="14" r="3.5" className="fill-primary" />
        <path d="M14 4v4m0 12v4M4 14h4m12 0h4" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      controla
    </span>
  );
}
