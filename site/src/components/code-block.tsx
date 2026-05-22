type CodeBlockProps = {
  code: string;
  label?: string;
  language?: string;
};

export function CodeBlock({ code, label, language }: CodeBlockProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border-soft bg-surface">
      {label ? (
        <div className="flex items-center justify-between border-b border-border-soft px-4 py-2 text-xs uppercase tracking-wider text-muted">
          <span>{label}</span>
          {language ? <span className="text-muted/70">{language}</span> : null}
        </div>
      ) : null}
      <pre className="overflow-x-auto px-4 py-4 font-mono text-sm leading-relaxed text-fg">
        <code>{code}</code>
      </pre>
    </div>
  );
}
