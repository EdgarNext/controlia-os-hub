"use client";

import { LoaderCircle } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useTransition, type ReactNode } from "react";

const EVENTS_PENDING_MESSAGE = "Actualizando eventos y costeo…";

type EventsNavigationContextValue = {
  isPending: boolean;
  navigate: (nextUrl: string) => void;
};

const EventsNavigationContext = createContext<EventsNavigationContextValue | null>(null);

export function useEventsNavigation() {
  const context = useContext(EventsNavigationContext);
  if (!context) throw new Error("useEventsNavigation debe utilizarse dentro de EventsNavigationShell.");
  return context;
}

export function EventsNavigationShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function navigate(nextUrl: string) {
    startTransition(() => {
      router.replace(nextUrl.startsWith("/") ? nextUrl : `${pathname}${nextUrl}`);
    });
  }

  return (
    <EventsNavigationContext.Provider value={{ isPending, navigate }}>
      {children}
    </EventsNavigationContext.Provider>
  );
}

export function EventsResultsFrame({ children }: { children: ReactNode }) {
  const { isPending } = useEventsNavigation();

  return (
    <section aria-busy={isPending || undefined} className="relative min-w-0">
      <div
        className={`pointer-events-none absolute inset-0 z-20 flex items-start justify-center rounded-[var(--radius-base)] bg-surface/75 p-6 backdrop-blur-[1px] transition-opacity duration-150 ${isPending ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <div
          className="sticky top-4 inline-flex items-center gap-2 rounded-[var(--radius-base)] border border-border bg-surface px-4 py-3 text-sm font-medium text-foreground shadow-sm"
          role="status"
          aria-live="polite"
        >
          <LoaderCircle className="h-5 w-5 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
          <span>{EVENTS_PENDING_MESSAGE}</span>
        </div>
      </div>
      <div
        inert={isPending || undefined}
        aria-disabled={isPending || undefined}
        className={`transition-opacity duration-150 ${isPending ? "pointer-events-none opacity-60" : "opacity-100"}`}
      >
        {children}
      </div>
    </section>
  );
}
