import Link from 'next/link';
import type { ReactNode } from 'react';

// Page heading in the controla.dev style: mono eyebrow, Space Grotesk title,
// muted lead text, optional actions on the right.
export function PageHeader({
  eyebrow,
  title,
  description,
  back,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8">
      {back && (
        <Link href={back.href} className="mb-5 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-primary">
          <span aria-hidden="true">←</span> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          {eyebrow && <p className="font-mono text-xs uppercase tracking-widest text-primary">{eyebrow}</p>}
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h1>
          {description && <div className="mt-2 text-muted">{description}</div>}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}
