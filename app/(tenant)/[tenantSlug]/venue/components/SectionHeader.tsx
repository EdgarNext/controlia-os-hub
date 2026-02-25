import { Building2 } from "lucide-react";

export function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="space-y-1">
      <div className="flex items-center gap-2">
        <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
        <h1 className="text-xl font-semibold">{title}</h1>
      </div>
      <p className="text-sm text-muted">{description}</p>
    </header>
  );
}
