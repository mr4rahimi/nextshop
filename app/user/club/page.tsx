import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import ClubPanelClient from "@/components/club/ClubPanelClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "باشگاه مشتریان",
};

export default async function ClubPage() {
  const user = await getAuthUser();
  if (!user) redirect("/user");

  return <ClubPanelClient />;
}
