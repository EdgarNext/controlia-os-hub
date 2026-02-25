import { EmptyState } from "../../components/EmptyState";
import { SectionHeader } from "../../components/SectionHeader";

export default function PosAdminKiosksPage() {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="POS Admin · Kiosks"
        description="Register kiosk devices and manage credentials for offline catalog sync."
      />
      <EmptyState message="Kiosk administration UI will be implemented in this section." />
    </div>
  );
}
