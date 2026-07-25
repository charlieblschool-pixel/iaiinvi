import type { Vendor } from "@/generated/prisma/client";
import { decryptVendorPassword } from "@/lib/vendor-credentials";

export type VendorOrderItem = {
  productName: string;
  quantity: number;
  unitLabel: string;
};

export type VendorOrderResult =
  | { status: "ready_for_review"; reviewUrl: string; message: string }
  | { status: "not_automated"; message: string };

type VendorAdapter = {
  /**
   * Logs into the vendor's B2B portal and adds items to the cart, stopping
   * short of checkout. Returns a URL where a human reviews and places the
   * order — this never submits payment on its own.
   */
  fillCart(
    credentials: { portalUrl: string; username: string; password: string; accountNumber?: string | null },
    items: VendorOrderItem[],
  ): Promise<{ reviewUrl: string }>;
};

// No adapter is implemented yet — automating UNITE's and Color Wow's actual
// ordering portals requires inspecting their real login/cart flow, which
// hasn't been done. Wire one up here once that reconnaissance happens.
const VENDOR_ADAPTERS: Record<string, VendorAdapter> = {};

function adapterKeyFor(vendorName: string): string | null {
  const name = vendorName.trim().toLowerCase();
  if (name.includes("unite")) return "unite";
  if (name.includes("color wow") || name.includes("colorwow")) return "colorwow";
  return null;
}

export function isVendorConnected(vendor: Vendor): boolean {
  return Boolean(vendor.portalUsername && vendor.portalPasswordEncrypted && vendor.portalUrl);
}

export async function placeVendorOrder(
  vendor: Vendor,
  items: VendorOrderItem[],
): Promise<VendorOrderResult> {
  if (!isVendorConnected(vendor)) {
    return { status: "not_automated", message: `${vendor.name} isn't connected — order manually.` };
  }

  const key = adapterKeyFor(vendor.name);
  const adapter = key ? VENDOR_ADAPTERS[key] : undefined;
  if (!adapter) {
    return {
      status: "not_automated",
      message: `No automated ordering is wired up for ${vendor.name} yet — sign in at ${vendor.portalUrl} to place this order.`,
    };
  }

  const { reviewUrl } = await adapter.fillCart(
    {
      portalUrl: vendor.portalUrl!,
      username: vendor.portalUsername!,
      password: decryptVendorPassword(vendor.portalPasswordEncrypted!),
      accountNumber: vendor.accountNumber,
    },
    items,
  );

  return {
    status: "ready_for_review",
    reviewUrl,
    message: `Cart filled on ${vendor.name} — review and place the order at ${reviewUrl}.`,
  };
}
