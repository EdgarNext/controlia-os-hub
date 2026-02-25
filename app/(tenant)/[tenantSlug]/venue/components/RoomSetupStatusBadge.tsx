import { Badge } from "@/components/ui/badge";

export function RoomSetupStatusBadge({ needsSetup }: { needsSetup: boolean }) {
  if (needsSetup) {
    return <Badge variant="warning">Needs setup</Badge>;
  }

  return <Badge variant="success">Ready</Badge>;
}
