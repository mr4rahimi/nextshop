// صفحات ورود/ثبت‌نام نباید ایندکس شوند.
export const metadata = { robots: { index: false, follow: true } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
