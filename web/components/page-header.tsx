export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b pb-5">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem] sm:leading-[1.15]">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Lightweight section divider used instead of nesting everything in cards. */
export function SectionTitle({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-4 mt-12 flex items-baseline justify-between gap-3 first:mt-0">
      <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
        {children}
      </h2>
      {aside ? <div className="text-xs text-muted-foreground">{aside}</div> : null}
    </div>
  );
}
