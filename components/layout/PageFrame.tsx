import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

type PageFrameProps = {
  children: ReactNode;
  mode?: "fluid" | "reading";
};

export function PageFrame({ children, mode = "fluid" }: PageFrameProps) {
  return (
    <div className="page-enter px-4 py-4 md:px-6 md:py-6">
      <div className={cn(mode === "reading" ? "mx-auto w-full max-w-4xl" : "w-full")}>{children}</div>
    </div>
  );
}
