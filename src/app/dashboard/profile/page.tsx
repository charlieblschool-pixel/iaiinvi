import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { ProfileNameForm, PasswordForm } from "@/components/dashboard/profile-forms";
import { Card } from "@/components/ui/card";

export default async function ProfilePage() {
  const { session, membership } = await requireOrg();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="mt-1 text-foreground-muted">
          Your account details for invii.ai.
        </p>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold">Account</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-foreground-muted">Email</dt>
            <dd className="mt-1">{user.email}</dd>
          </div>
          <div>
            <dt className="text-foreground-muted">Role</dt>
            <dd className="mt-1 capitalize">{membership.role.toLowerCase()}</dd>
          </div>
        </dl>
      </Card>

      <ProfileNameForm initialName={user.name ?? ""} />
      <PasswordForm hasPassword={Boolean(user.passwordHash)} />
    </div>
  );
}
