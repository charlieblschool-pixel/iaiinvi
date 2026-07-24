import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { DEFAULT_LOCATIONS, LOCATION_LABELS } from "@/lib/locations";

const DEMO_EMAIL = "demo@invii.ai";
const DEMO_PASSWORD = "demopassword123";

async function main() {
  const existing = await prisma.organization.findUnique({
    where: { slug: "riverside-barber-co" },
  });
  if (existing) {
    console.log("Demo workspace already exists — skipping seed.");
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const user = await prisma.user.create({
    data: { name: "Jordan Lee", email: DEMO_EMAIL, passwordHash },
  });

  const organization = await prisma.organization.create({
    data: {
      name: "Riverside Barber Co.",
      slug: "riverside-barber-co",
      memberships: { create: { userId: user.id, role: "OWNER" } },
      locations: {
        create: DEFAULT_LOCATIONS.map((type) => ({
          type,
          name: LOCATION_LABELS[type],
        })),
      },
      subscription: { create: { plan: "STANDARD" } },
    },
    include: { locations: true },
  });

  const locationByType = Object.fromEntries(
    organization.locations.map((l) => [l.type, l]),
  );

  const vendor = await prisma.vendor.create({
    data: {
      name: "Salon Supply Co.",
      leadTimeDays: 5,
      organizationId: organization.id,
    },
  });

  const products: {
    name: string;
    unitLabel: string;
    casePackSize: number;
    unitCost: number;
    avgWeeklyUsage: number;
    autoReorder: boolean;
    location: keyof typeof locationByType;
    onHand: number;
    reorderPoint: number;
  }[] = [
    {
      name: "Pomade — Matte Finish",
      unitLabel: "jar",
      casePackSize: 12,
      unitCost: 7,
      avgWeeklyUsage: 8,
      autoReorder: true,
      location: "BACKBAR",
      onHand: 6,
      reorderPoint: 8,
    },
    {
      name: "Neck Powder",
      unitLabel: "canister",
      casePackSize: 6,
      unitCost: 4,
      avgWeeklyUsage: 3,
      autoReorder: true,
      location: "BACKBAR",
      onHand: 24,
      reorderPoint: 10,
    },
    {
      name: "Talc Refill",
      unitLabel: "bag",
      casePackSize: 6,
      unitCost: 3,
      avgWeeklyUsage: 2,
      autoReorder: false,
      location: "BACKBAR",
      onHand: 15,
      reorderPoint: 6,
    },
    {
      name: "Beard Oil — Sandalwood",
      unitLabel: "bottle",
      casePackSize: 12,
      unitCost: 6,
      avgWeeklyUsage: 4,
      autoReorder: true,
      location: "RETAIL_SHELF",
      onHand: 30,
      reorderPoint: 12,
    },
    {
      name: "Aftershave Tonic",
      unitLabel: "bottle",
      casePackSize: 6,
      unitCost: 7,
      avgWeeklyUsage: 5,
      autoReorder: true,
      location: "RETAIL_SHELF",
      onHand: 0,
      reorderPoint: 8,
    },
    {
      name: "Sea Salt Spray",
      unitLabel: "bottle",
      casePackSize: 12,
      unitCost: 7,
      avgWeeklyUsage: 6,
      autoReorder: true,
      location: "RETAIL_SHELF",
      onHand: 9,
      reorderPoint: 10,
    },
    {
      name: "Clipper Guard Set",
      unitLabel: "set",
      casePackSize: 4,
      unitCost: 15,
      avgWeeklyUsage: 1,
      autoReorder: false,
      location: "IN_USE",
      onHand: 2,
      reorderPoint: 4,
    },
    {
      name: "Shear Oil",
      unitLabel: "bottle",
      casePackSize: 6,
      unitCost: 5,
      avgWeeklyUsage: 1,
      autoReorder: false,
      location: "IN_USE",
      onHand: 5,
      reorderPoint: 3,
    },
  ];

  for (const p of products) {
    await prisma.product.create({
      data: {
        name: p.name,
        unitLabel: p.unitLabel,
        casePackSize: p.casePackSize,
        unitCost: p.unitCost,
        avgWeeklyUsage: p.avgWeeklyUsage,
        autoReorder: p.autoReorder,
        organizationId: organization.id,
        vendorId: vendor.id,
        stockLevels: {
          create: {
            locationId: locationByType[p.location].id,
            onHand: p.onHand,
            reorderPoint: p.reorderPoint,
          },
        },
      },
    });
  }

  await prisma.activityLogEntry.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      type: "MEMBER_INVITED",
      message: `${user.name} created the ${organization.name} workspace`,
    },
  });

  console.log(`Seeded demo workspace. Log in with ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
