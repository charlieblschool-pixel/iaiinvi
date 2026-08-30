import { DashboardChrome } from "@/components/dashboard/dashboard-chrome";
import { requireOrg } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { emailEnabled } from "@/lib/email";

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

  // Don't nag people to verify an email we currently have no way to send —
  // the banner reappears on its own once RESEND_API_KEY is configured.
  const showVerifyBanner = emailEnabled && !user?.emailVerified;

  return (
    <DashboardChrome
      orgName={organization.name}
      userName={session.user.name ?? "You"}
      userEmail={session.user.email ?? ""}
      emailVerified={!showVerifyBanner}
    >
      {children}
    </DashboardChrome>
  );
}
