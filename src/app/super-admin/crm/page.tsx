"use client";

import { ModulePage } from "@/components/super-admin-module-page";
import { CrmModule } from "@/components/crm-module";

export default function CrmPage() {
  return (
    <ModulePage titre="CRM commercial">
      <CrmModule />
    </ModulePage>
  );
}
