import { DashboardChrome } from "@/components/dashboard/dashboard-chrome";
import { requireOrg } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, organization } = await requireOrg();

  return (
    <DashboardChrome
      orgName={organization.name}
      userName={session.user.name ?? "You"}
      userEmail={session.user.email ?? ""}
    >
      {children}
    </DashboardChrome>
  );
}
