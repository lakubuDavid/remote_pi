import type { ReactNode } from "react";

type FeatureCardProps = {
  title: string;
  description: ReactNode;
  icon?: ReactNode;
};

export function FeatureCard({ title, description, icon }: FeatureCardProps) {
  return (
    <article className="flex h-full flex-col gap-3 rounded-2xl border border-border-soft bg-surface p-6 transition-colors hover:border-fg/20">
      {icon ? (
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
          {icon}
        </div>
      ) : null}
      <h3 className="text-lg font-semibold tracking-tight text-fg">{title}</h3>
      <p className="text-sm leading-relaxed text-muted">{description}</p>
    </article>
  );
}
