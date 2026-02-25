import { Card } from "@/components/ui/card";
import { CollapsibleDemo } from "./CollapsibleDemo";
import { ModalDemo } from "./ModalDemo";

export function AnimationShowcase() {
  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold">Animations</h3>
      <div className="space-y-5">
        <ModalDemo />
        <CollapsibleDemo />
      </div>
    </Card>
  );
}
