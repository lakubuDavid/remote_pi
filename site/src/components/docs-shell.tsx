import type { ReactNode } from "react";

type DocsShellProps = {
  title: string;
  lastUpdated: string;
  intro?: ReactNode;
  children: ReactNode;
};

export function DocsShell({ title, lastUpdated, intro, children }: DocsShellProps) {
  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-20">
      <header className="mb-12 flex flex-col gap-3 border-b border-border-soft pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Documentation
        </p>
        <h1 className="text-balance text-4xl font-semibold tracking-tight text-fg sm:text-5xl">
          {title}
        </h1>
        <p className="text-sm text-muted">Last updated: {lastUpdated}</p>
        {intro ? (
          <div className="text-base leading-relaxed text-muted">{intro}</div>
        ) : null}
      </header>
      <div className="docs-prose flex flex-col gap-12">{children}</div>
    </article>
  );
}

type DocsSectionProps = {
  id: string;
  title: string;
  children: ReactNode;
};

export function DocsSection({ id, title, children }: DocsSectionProps) {
  return (
    <section id={id} className="flex flex-col gap-4 scroll-mt-24">
      <h2 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
        {title}
      </h2>
      <div className="flex flex-col gap-4 text-[15px] leading-[1.75] text-muted">
        {children}
      </div>
    </section>
  );
}

export function DocsSubsection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div id={id} className="flex flex-col gap-3 scroll-mt-24">
      <h3 className="text-lg font-semibold text-fg sm:text-xl">{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

export function InlineCode({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[0.85em] text-fg">
      {children}
    </code>
  );
}

export function DocsTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border-soft">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-surface">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="border-b border-border-soft px-4 py-3 font-semibold text-fg"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr
              key={i}
              className="border-t border-border-soft/60 align-top text-muted"
            >
              {cells.map((cell, j) => (
                <td key={j} className="px-4 py-3">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
