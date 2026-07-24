import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { PageFrame } from "@/components/marketing/page-frame";
import { LinkButton } from "@/components/ui/button";

export default function AboutPage() {
  return (
    <>
      <PageFrame />
      <MarketingNav />
      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-6 py-24">
          <p className="text-sm font-medium uppercase tracking-wider text-brand-light">
            About
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">
            Built for the person who notices stock before the shelf does.
          </h1>
          <div className="mt-8 flex flex-col gap-5 text-lg text-foreground-muted">
            <p>
              Most inventory tools were built for warehouses with one door in
              and one door out. Most small and mid-size businesses don&rsquo;t
              work that way — stock sits on a retail shelf, behind the counter,
              in a van, and on a backbar, all at once, and it moves between
              them without anyone logging it.
            </p>
            <p>
              invii.ai starts from that reality. It tracks stock across nine
              distinct location types, learns how fast each product actually
              moves, and calculates the reorder point from your real vendor
              lead times — not a generic default. When it&rsquo;s confident,
              it can place the order itself.
            </p>
            <p>
              The goal isn&rsquo;t a prettier spreadsheet. It&rsquo;s never
              finding out you&rsquo;re out of something from a customer again.
            </p>
          </div>
          <div className="mt-10">
            <LinkButton href="/signup" size="lg">
              Start free
            </LinkButton>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
