type KbdHintProps = {
  keys: string;
};

export function KbdHint({ keys }: KbdHintProps) {
  return (
    <kbd className="hidden rounded-[calc(var(--radius-base)-8px)] border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted md:inline-block">
      {keys}
    </kbd>
  );
}
