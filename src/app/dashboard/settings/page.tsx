import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { LOCATION_ORDER } from "@/lib/locations";
import { Card } from "@/components/ui/card";
import {
  OrganizationNameForm,
  NewVendorForm,
  NewCategoryForm,
  StaffCard,
  DeleteWorkspaceButton,
} from "@/components/dashboard/settings-forms";
import { ConnectionsCard } from "@/components/dashboard/connections-card";
import { LocationManager } from "@/components/dashboard/location-edit-row";

export default async function SettingsPage() {
  const { session, organization, membership } = await requireOrg();

  const [locations, vendors, categories, memberships] = await Promise.all([
    prisma.location.findMany({
      where: { organizationId: organization.id },
      orderBy: LOCATION_ORDER,
      include: { _count: { select: { stockLevels: true } } },
    }),
    prisma.vendor.findMany({
      where: { organizationId: organization.id },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { organizationId: organization.id },
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    }),
    prisma.membership.findMany({
      where: { organizationId: organization.id },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const staff = memberships.map((m) => ({
    membershipId: m.id,
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-foreground-muted">
          Manage your workspace, locations, categories, and vendors.
        </p>
      </div>

      <OrganizationNameForm initialName={organization.name} />

      <Card className="p-6">
        <h2 className="font-semibold">Locations</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          The places you keep product, in the order you walk them when
          counting. Spreadsheet imports match these by name (typos included).
        </p>
        <div className="mt-4">
          <LocationManager
            canDelete={membership.role !== "STAFF"}
            locations={locations.map((l) => ({
              id: l.id,
              name: l.name,
              productCount: l._count.stockLevels,
            }))}
          />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold">Categories</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          Every product is Backbar (used on clients) or Retail (sold to
          clients). Add more only if you need them.
        </p>
        {categories.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2 text-sm">
            {categories.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-lg border border-border-hairline px-4 py-2.5"
              >
                <span>{c.name}</span>
                <span className="text-foreground-muted">
                  {c._count.products} product{c._count.products === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <NewCategoryForm />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold">Vendors</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          Lead times drive the reorder engine — add each supplier once.
        </p>
        {vendors.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2 text-sm">
            {vendors.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between rounded-lg border border-border-hairline px-4 py-2.5"
              >
                <span>{v.name}</span>
                <span className="text-foreground-muted">
                  {v.leadTimeDays}-day lead time
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <NewVendorForm />
        </div>
      </Card>

      <StaffCard
        members={staff}
        currentUserId={session.user.id}
        isOwner={membership.role === "OWNER"}
      />

      <ConnectionsCard
        vendors={vendors.map((v) => ({
          id: v.id,
          name: v.name,
          connected: Boolean(v.connectedAt),
          portalUrl: v.portalUrl,
          portalUsername: v.portalUsername,
          accountNumber: v.accountNumber,
        }))}
      />

      {membership.role === "OWNER" && (
        <Card className="border-status-bad/40 p-6">
          <h2 className="font-semibold text-status-bad">Danger zone</h2>
          <p className="mt-1 text-sm text-foreground-muted">
            Deleting your workspace removes all products, stock levels, and
            history for everyone on it. This can&rsquo;t be undone.
          </p>
          <div className="mt-4">
            <DeleteWorkspaceButton />
          </div>
        </Card>
      )}
    </div>
  );
}
