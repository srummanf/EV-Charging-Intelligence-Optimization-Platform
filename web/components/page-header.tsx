export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6 space-y-1">
      <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
      {description ? (
        <p className="max-w-2xl text-sm text-text-secondary">{description}</p>
      ) : null}
    </div>
  );
}
