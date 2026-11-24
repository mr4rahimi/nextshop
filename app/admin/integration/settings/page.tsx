import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "تنظیمات یکپارچه‌سازی" };

export default function IntegrationSettingsPage() {
  return <SettingsClient />;
}
