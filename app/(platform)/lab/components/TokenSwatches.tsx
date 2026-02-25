const swatches = [
  { key: "surface", bg: "bg-surface", text: "text-foreground" },
  { key: "background", bg: "bg-background", text: "text-foreground" },
  { key: "primary", bg: "bg-primary", text: "text-primary-foreground" },
  { key: "success", bg: "bg-success", text: "text-foreground" },
  { key: "warning", bg: "bg-warning", text: "text-foreground" },
  { key: "danger", bg: "bg-danger", text: "text-primary-foreground" },
];

export function TokenSwatches() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {swatches.map((item) => (
        <div
          key={item.key}
          className={`rounded-base border border-border p-4 ${item.bg} ${item.text}`}
        >
          <p className="text-sm font-medium">{item.key}</p>
          <p className="mt-8 text-xs opacity-80">Token preview</p>
        </div>
      ))}
    </div>
  );
}
