export function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="space-y-1">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted">{description}</p>
    </header>
  );
}
