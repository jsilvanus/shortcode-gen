import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getAllowedShortCodeDomains } from "@/lib/settings";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (user.role !== "ADMIN") redirect("/admin/dashboard");

  const domains = await getAllowedShortCodeDomains();

  return (
    <main>
      <h1>Site settings</h1>
      <h2>Allowed target domains</h2>
      <p>Only administrators can change this setting.</p>
      <textarea name="domains" defaultValue={domains.join("\n")} rows={10} cols={50} />
    </main>
  );
}
