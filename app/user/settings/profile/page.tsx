import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ProfileSettingsClient from "@/components/user/ProfileSettingsClient";

export const metadata = { title: "ویرایش پروفایل" };

export default async function ProfilePage() {
  const user = await getAuthUser();
  if (!user) return null;

  const data = await prisma.user.findUnique({
    where: { id: user.id },
    select: { firstName: true, lastName: true, email: true, nationalCode: true, avatarUrl: true, phone: true },
  });

  return <ProfileSettingsClient user={data!} />;
}
