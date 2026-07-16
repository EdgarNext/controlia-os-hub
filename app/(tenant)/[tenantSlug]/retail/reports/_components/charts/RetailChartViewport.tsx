"use client";

import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

type RetailChartViewportProps = {
  heightClassName: string;
  children: ReactNode;
};

function subscribe() {
  return () => {};
}

export function RetailChartViewport({ heightClassName, children }: RetailChartViewportProps) {
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);

  return (
    <div className={`${heightClassName} w-full`}>
      {!isClient ? (
        <div
          className="h-full w-full animate-pulse rounded-[var(--radius-base)] bg-surface-2"
          aria-hidden="true"
        />
      ) : (
        children
      )}
    </div>
  );
}
