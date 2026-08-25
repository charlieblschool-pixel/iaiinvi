import { DashboardChrome } from "@/components/dashboard/dashboard-chrome";
import { requireOrg } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, organization } = await requireOrg();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailVerified: true },
  });

  return (
    <DashboardChrome
      orgName={organization.name}
      userName={session.user.name ?? "You"}
      userEmail={session.user.email ?? ""}
      emailVerified={Boolean(user?.emailVerified)}
    >
      {children}
    </DashboardChrome>
  );
}
