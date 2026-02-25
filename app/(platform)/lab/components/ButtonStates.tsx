"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ButtonStates() {
  const [loading, setLoading] = useState(false);

  async function handleLoadingDemo() {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setLoading(false);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button>Default</Button>
      <Button variant="secondary">Hover me</Button>
      <Button disabled>Disabled</Button>
      <Button isLoading={loading} onClick={handleLoadingDemo}>
        Loading
      </Button>
    </div>
  );
}
