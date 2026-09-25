import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { BACKBAR, RETAIL, USAGE_CATEGORIES } from "@/lib/categories";
import { EXAMPLE_LOCATIONS } from "@/lib/locations";
import { formatProductCode } from "@/lib/product-codes";

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
        create: EXAMPLE_LOCATIONS.map((name, i) => ({ name, sortOrder: i + 1 })),
      },
      categories: { create: USAGE_CATEGORIES.map((name) => ({ name })) },
      subscription: { create: { plan: "STANDARD" } },
    },
    include: { locations: true, categories: true },
  });

  const locationByName = Object.fromEntries(organization.locations.map((l) => [l.name, l]));
  const categoryByName = Object.fromEntries(organization.categories.map((c) => [c.name, c]));

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
    category: string;
    location: string;
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
      category: BACKBAR,
      location: "Cabinet",
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
      category: BACKBAR,
      location: "Cabinet",
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
      category: BACKBAR,
      location: "Cabinet",
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
      category: RETAIL,
      location: "Top of Retail Shelf",
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
      category: RETAIL,
      location: "Top of Retail Shelf",
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
      category: RETAIL,
      location: "Top of Retail Shelf",
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
      category: BACKBAR,
      location: "Floor",
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
      category: BACKBAR,
      location: "Floor",
      onHand: 5,
      reorderPoint: 3,
    },
  ];

  for (const [i, p] of products.entries()) {
    await prisma.product.create({
      data: {
        code: formatProductCode(i + 1),
        name: p.name,
        unitLabel: p.unitLabel,
        casePackSize: p.casePackSize,
        unitCost: p.unitCost,
        avgWeeklyUsage: p.avgWeeklyUsage,
        autoReorder: p.autoReorder,
        organizationId: organization.id,
        vendorId: vendor.id,
        categoryId: categoryByName[p.category].id,
        stockLevels: {
          create: {
            locationId: locationByName[p.location].id,
            onHand: p.onHand,
            reorderPoint: p.reorderPoint,
          },
        },
      },
    });
  }

  await prisma.organization.update({
    where: { id: organization.id },
    data: { nextProductNumber: products.length + 1 },
  });

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
