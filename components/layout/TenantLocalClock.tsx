"use client";

import { useEffect, useState } from "react";
import { formatLocalDateTime } from "@/lib/formatters/local-date-time";

type TenantLocalClockProps = {
  initialText: string;
  initialDateTime: string;
};

export function TenantLocalClock({ initialText, initialDateTime }: TenantLocalClockProps) {
  const [text, setText] = useState(initialText);

  useEffect(() => {
    const update = () => setText(formatLocalDateTime(new Date()));
    update();

    const intervalId = window.setInterval(update, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <time dateTime={initialDateTime} className="whitespace-nowrap text-xs text-muted" aria-label="Hora local">
      {text}
    </time>
  );
}
