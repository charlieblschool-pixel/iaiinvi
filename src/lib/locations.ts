import { LocationType } from "@/generated/prisma/enums";

export const LOCATION_LABELS: Record<LocationType, string> = {
  STOREROOM: "Storeroom",
  RETAIL_SHELF: "Retail Shelf",
  BACKBAR: "Backbar / Prep",
  IN_USE: "In Use",
  WAREHOUSE: "Warehouse",
  DISPLAY: "Display",
  FRONT_COUNTER: "Front Counter",
  MOBILE_VAN: "Mobile / Van Stock",
  BACK_OFFICE: "Back Office",
};

export const DEFAULT_LOCATIONS: LocationType[] = [
  "STOREROOM",
  "RETAIL_SHELF",
  "BACKBAR",
  "IN_USE",
  "WAREHOUSE",
  "DISPLAY",
  "FRONT_COUNTER",
  "MOBILE_VAN",
  "BACK_OFFICE",
];
