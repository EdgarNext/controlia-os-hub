"use client";

import { useState, type ReactNode } from "react";
import { KitchenSubmitButton } from "./kitchen-submit-button";

type KitchenCriticalAction = {
  id: string;
  action: (formData: FormData) => void | Promise<void>;
  fields: Array<{ name: string; value: string }>;
  label: ReactNode;
  pendingLabel: ReactNode;
};

type KitchenCriticalActionGroupProps = {
  actions: KitchenCriticalAction[];
  className?: string;
  buttonClassName?: string;
};

export function KitchenCriticalActionGroup({
  actions,
  className,
  buttonClassName,
}: KitchenCriticalActionGroupProps) {
  const [activeActionId, setActiveActionId] = useState<string | null>(null);

  return (
    <div className={className}>
      {actions.map((item) => (
        <form key={item.id} action={item.action} onSubmit={() => setActiveActionId(item.id)}>
          {item.fields.map((field) => (
            <input key={`${item.id}-${field.name}`} type="hidden" name={field.name} value={field.value} />
          ))}
          <KitchenSubmitButton
            variant="secondary"
            pendingLabel={item.pendingLabel}
            disabled={activeActionId !== null && activeActionId !== item.id}
            className={buttonClassName}
          >
            {item.label}
          </KitchenSubmitButton>
        </form>
      ))}
    </div>
  );
}
