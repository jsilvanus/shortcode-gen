import { redirect } from "next/navigation";
import { requireCurrentDomainAdmin } from "@/lib/domain-context";
import { getDomainSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/settings-form";

export default async function SettingsPage() {
  let context;
  try {
    context = await requireCurrentDomainAdmin();
  } catch {
    redirect("/admin/login");
  }

  const settings = await getDomainSettings(context.domain.id);

  return (
    <main>
      <h1>Domain settings</h1>
      <p>Configuring {context.domain.hostname}</p>
      <SettingsForm initialSettings={settings} />
    </main>
  );
}
