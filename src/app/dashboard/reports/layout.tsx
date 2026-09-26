import { SectionTabs } from "@/components/dashboard/section-tabs";

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="mt-1 text-foreground-muted">
          Derived from your actual stock, usage, and vendor lead times.
        </p>
      </div>
      <SectionTabs
        label="Reports"
        tabs={[
          { href: "/dashboard/reports", label: "Overview" },
          { href: "/dashboard/reports/reorder", label: "Reorder list" },
        ]}
      />
      {children}
    </div>
  );
}
