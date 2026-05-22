import type { ReactNode } from "react";

type LegalShellProps = {
  title: string;
  lastUpdated: string;
  subtitle?: ReactNode;
  children: ReactNode;
};

export function LegalShell({ title, lastUpdated, subtitle, children }: LegalShellProps) {
  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-20">
      <header className="mb-12 flex flex-col gap-3 border-b border-border-soft pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Legal
        </p>
        <h1 className="text-balance text-4xl font-semibold tracking-tight text-fg sm:text-5xl">
          {title}
        </h1>
        <p className="text-sm text-muted">Last updated: {lastUpdated}</p>
        {subtitle ? (
          <div className="text-sm leading-relaxed text-muted">{subtitle}</div>
        ) : null}
      </header>
      <div className="legal-prose flex flex-col gap-10">{children}</div>
    </article>
  );
}

type SectionProps = {
  id: string;
  number: number;
  title: string;
  children: ReactNode;
};

export function LegalSection({ id, number, title, children }: SectionProps) {
  return (
    <section id={id} className="flex flex-col gap-3 scroll-mt-24">
      <h2 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">
        {number}. {title}
      </h2>
      <div className="flex flex-col gap-3 text-[15px] leading-[1.75] text-muted">
        {children}
      </div>
    </section>
  );
}
