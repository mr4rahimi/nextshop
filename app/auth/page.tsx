import { Suspense } from "react";
import AuthClient from "@/components/auth/AuthClient";

export const metadata = { title: "ورود | فروشگاه" };

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthClient />
    </Suspense>
  );
}