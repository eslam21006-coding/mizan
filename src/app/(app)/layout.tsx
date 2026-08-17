import { AppShell } from "@/components/app-shell";
import { requireAuthContext } from "@/lib/auth/context";

export default async function ApplicationLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const auth = await requireAuthContext();
  return (
    <AppShell role={auth.role} email={auth.email}>
      {children}
    </AppShell>
  );
}
