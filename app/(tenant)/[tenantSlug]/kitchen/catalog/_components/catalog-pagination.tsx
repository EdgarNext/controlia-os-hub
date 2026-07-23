"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { useOptionalCatalogNavigation } from "./catalog-navigation-shell";

type Props = { previousHref?: string; nextHref?: string; page: number; pageCount: number; total: number; pageSize?: number; entityLabel?: string };

export function CatalogPagination({ previousHref, nextHref, page, total, pageSize = 25, entityLabel = "insumos" }: Props) {
  const context = useOptionalCatalogNavigation(); const router = useRouter(); const pathname = usePathname(); const [, startTransition] = useTransition();
  const go = context?.navigate ?? ((href: string) => startTransition(() => router.replace(href.startsWith("/") ? href : `${pathname}${href}`, { scroll: false })));
  function navigate(event: React.MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); go(href);
  }
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1; const end = Math.min(total, page * pageSize);
  return <div className="relative flex items-center justify-between text-sm text-muted"><span>{total ? `Mostrando ${start}–${end} de ${total} ${entityLabel}` : `0 ${entityLabel}`}</span><div className="flex gap-2">{previousHref ? <Link onClick={(event) => navigate(event, previousHref)} className="rounded border border-border px-3 py-1" href={previousHref}>Anterior</Link> : null}{nextHref ? <Link onClick={(event) => navigate(event, nextHref)} className="rounded border border-border px-3 py-1" href={nextHref}>Siguiente</Link> : null}</div></div>;
}
