"use client";

import { useState } from "react";
import type { SiteSettings } from "@/lib/settings";

export function SettingsForm({ initialSettings }: { initialSettings: SiteSettings }) {
  const [settings, setSettings] = useState(initialSettings);
  const [message, setMessage] = useState("");

  async function save() {
    setMessage("Saving…");
    const response = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setMessage(response.ok ? "Saved." : "Could not save settings.");
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <fieldset><legend>General</legend>
        <label>Site name<input value={settings.general.siteName} onChange={e => setSettings(s => ({ ...s, general: { ...s.general, siteName: e.target.value } }))} /></label>
        <label>Description<textarea value={settings.general.siteDescription} onChange={e => setSettings(s => ({ ...s, general: { ...s.general, siteDescription: e.target.value } }))} /></label>
        <label>Public URL<input type="url" value={settings.general.publicUrl} onChange={e => setSettings(s => ({ ...s, general: { ...s.general, publicUrl: e.target.value } }))} /></label>
      </fieldset>

      <fieldset><legend>Link policy</legend>
        <label>Allowed target domains<textarea value={settings.linkPolicy.allowedDomains.join("\n")} onChange={e => setSettings(s => ({ ...s, linkPolicy: { ...s.linkPolicy, allowedDomains: e.target.value.split(/\r?\n/).map(v => v.trim()).filter(Boolean) } }))} /></label>
        <label><input type="checkbox" checked={settings.linkPolicy.defaultPrivate} onChange={e => setSettings(s => ({ ...s, linkPolicy: { ...s.linkPolicy, defaultPrivate: e.target.checked } }))} /> New links private by default</label>
        <label><input type="checkbox" checked={settings.linkPolicy.allowCustomCodes} onChange={e => setSettings(s => ({ ...s, linkPolicy: { ...s.linkPolicy, allowCustomCodes: e.target.checked } }))} /> Allow custom codes</label>
      </fieldset>

      <fieldset><legend>Privacy</legend>
        <label>Data controller<input value={settings.privacy.controllerName} onChange={e => setSettings(s => ({ ...s, privacy: { ...s.privacy, controllerName: e.target.value } }))} /></label>
        <label>Contact email<input type="email" value={settings.privacy.contactEmail} onChange={e => setSettings(s => ({ ...s, privacy: { ...s.privacy, contactEmail: e.target.value } }))} /></label>
        <label>Privacy policy URL<input type="url" value={settings.privacy.privacyPolicyUrl} onChange={e => setSettings(s => ({ ...s, privacy: { ...s.privacy, privacyPolicyUrl: e.target.value } }))} /></label>
        <label>Processor information<textarea value={settings.privacy.processorInfo} onChange={e => setSettings(s => ({ ...s, privacy: { ...s.privacy, processorInfo: e.target.value } }))} /></label>
        <label>Analytics description<textarea value={settings.privacy.analyticsDescription} onChange={e => setSettings(s => ({ ...s, privacy: { ...s.privacy, analyticsDescription: e.target.value } }))} /></label>
      </fieldset>

      <fieldset><legend>Appearance</legend>
        <label>Brand icon URL<input type="url" value={settings.appearance.brandIconUrl} onChange={e => setSettings(s => ({ ...s, appearance: { ...s.appearance, brandIconUrl: e.target.value } }))} /></label>
        <label>Favicon URL<input type="url" value={settings.appearance.faviconUrl} onChange={e => setSettings(s => ({ ...s, appearance: { ...s.appearance, faviconUrl: e.target.value } }))} /></label>
        <label>Footer text<textarea value={settings.appearance.footerText} onChange={e => setSettings(s => ({ ...s, appearance: { ...s.appearance, footerText: e.target.value } }))} /></label>
      </fieldset>

      <button type="submit">Save settings</button>
      <p role="status">{message}</p>
    </form>
  );
}
