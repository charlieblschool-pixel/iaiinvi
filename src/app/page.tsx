import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { HeroSuggestionCard } from "@/components/marketing/hero-suggestion-card";
import { HeroBackdrop } from "@/components/marketing/hero-backdrop";
import { PageFrame } from "@/components/marketing/page-frame";
import { FloatingPathsBackdrop } from "@/components/marketing/floating-paths";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LOCATION_LABELS, DEFAULT_LOCATIONS } from "@/lib/locations";
import { STANDARD_PLAN } from "@/lib/stripe";

const steps = [
  {
    n: "01",
    title: "Connect your vendors",
    body: "Add each supplier once with their lead time. invii.ai uses it to know exactly when today's order will actually arrive.",
  },
  {
    n: "02",
    title: "Track every location",
    body: "Storeroom, backbar, retail shelf, van stock — whatever holds your product, invii.ai counts it separately so nothing gets missed.",
  },
  {
    n: "03",
    title: "The engine calculates the reorder point",
    body: "Usage velocity plus vendor lead time plus a safety buffer, rounded up to a full case pack — no more ordering 14 of something that ships in 12s.",
  },
  {
    n: "04",
    title: "Approve it, or let it run",
    body: "Review each suggestion in the queue, or flip auto-reorder on a product and let invii.ai place and pay for the order itself.",
  },
];

const features = [
  {
    title: "9 location types out of the box",
    body: "Storeroom, retail shelf, backbar, in-use, warehouse, display, front counter, mobile stock, back office — stock is tracked where it actually sits.",
  },
  {
    title: "Lead-time-aware reorder points",
    body: "Every vendor has a real lead time. The engine works backward from it so orders land before you run out, not after.",
  },
  {
    title: "Case-pack rounding",
    body: "Suggestions round up to how your vendor actually ships — full cases, full boxes — so nobody's placing odd-lot orders by hand.",
  },
  {
    title: "Approve or auto-charge",
    body: "Keep a human in the loop on every order, or trust the engine to place and pay for routine restocks on its own, product by product.",
  },
  {
    title: "A full activity log",
    body: "Every stock change, approval, skip, and auto-charge is timestamped and attributed — an audit trail you didn't have to build.",
  },
  {
    title: "Upload your existing spreadsheet",
    body: "Already track inventory in Excel or Sheets? Import it directly — categories, products, and stock counts land in the right place automatically.",
  },
];

const statStrip = [
  "9 LOCATION TYPES",
  "CASE-PACK ACCURATE",
  "REORDER ENGINE ALWAYS ON",
];

export default function Home() {
  return (
    <>
      <PageFrame />
      <MarketingNav />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <HeroBackdrop />
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[-160px] h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-brand/15 blur-[140px]"
          />
          <div className="relative mx-auto grid max-w-6xl gap-14 px-6 py-24 lg:grid-cols-2 lg:items-center lg:py-32">
            <div>
              <p className="text-sm font-medium uppercase tracking-wider text-brand-light">
                Automatic inventory management
              </p>
              <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
                Inventory that reorders itself.
              </h1>
              <p className="mt-6 max-w-lg text-lg text-foreground-muted">
                invii.ai watches stock across every location you have, works
                out the reorder point from your vendors&rsquo; real lead
                times, and queues the order — or places it — before you run
                out.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <LinkButton href="/signup" size="lg">
                  Start free
                </LinkButton>
                <LinkButton href="#how-it-works" variant="secondary" size="lg">
                  See how it works
                </LinkButton>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t border-border-hairline pt-6 text-xs font-medium tracking-wider text-foreground-muted">
                {statStrip.map((s) => (
                  <span key={s}>{s}</span>
                ))}
              </div>
            </div>
            <div className="relative flex justify-center lg:justify-end">
              <HeroSuggestionCard />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-t border-border-hairline">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <h2 className="text-3xl font-semibold tracking-tight">
              How the reorder engine works
            </h2>
            <p className="mt-3 max-w-xl text-foreground-muted">
              Four steps, in order — each one feeds the next.
            </p>
            <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step) => (
                <div key={step.n}>
                  <span className="font-[var(--font-mono)] text-sm text-brand-light">
                    {step.n}
                  </span>
                  <h3 className="mt-3 font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm text-foreground-muted">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Location types */}
        <section id="locations" className="border-t border-border-hairline bg-surface/40">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <h2 className="text-3xl font-semibold tracking-tight">
              Stock lives in nine different places. invii.ai counts all of them.
            </h2>
            <p className="mt-3 max-w-xl text-foreground-muted">
              Set up once — every workspace starts with the full set, and you
              can rename or add your own categories on top.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              {DEFAULT_LOCATIONS.map((type) => (
                <span
                  key={type}
                  className="rounded-full border border-border-hairline bg-surface px-4 py-2 text-sm text-foreground-muted"
                >
                  {LOCATION_LABELS[type]}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t border-border-hairline">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <h2 className="text-3xl font-semibold tracking-tight">
              Everything the queue needs to make a good call
            </h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <Card key={feature.title} className="p-6">
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-foreground-muted">
                    {feature.body}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-t border-border-hairline bg-surface/40">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <h2 className="text-3xl font-semibold tracking-tight">
              One plan. Everything included.
            </h2>
            <p className="mt-3 max-w-xl text-foreground-muted">
              No tiers to compare, no feature gates — every workspace gets
              the full reorder engine.
            </p>
            <div className="mt-12 flex justify-center">
              <Card className="w-full max-w-sm border-brand p-8 text-center shadow-[0_0_60px_-25px_var(--brand)]">
                <h3 className="font-semibold">invii.ai Standard</h3>
                <p className="mt-6 font-[var(--font-mono)] text-4xl font-semibold">
                  ${(STANDARD_PLAN.amountCents / 100).toFixed(0)}
                  <span className="text-base font-normal text-foreground-muted">
                    {" "}
                    /month
                  </span>
                </p>
                <ul className="mt-6 flex flex-col gap-2.5 text-left text-sm text-foreground-muted">
                  {[
                    "Unlimited products, categories & locations",
                    "AI reorder engine — approve or auto-charge",
                    "Spreadsheet import for existing inventory",
                    "Full activity log, reports & weekly invoices",
                  ].map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-brand-light">—</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <LinkButton href="/signup" className="mt-8 w-full">
                  Start free
                </LinkButton>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden border-t border-border-hairline">
          <FloatingPathsBackdrop />
          <div className="relative mx-auto max-w-3xl px-6 py-24 text-center">
            <h2 className="text-3xl font-semibold tracking-tight">
              Stop finding out you&rsquo;re out of stock from a customer.
            </h2>
            <div className="mt-8">
              <LinkButton href="/signup" size="lg">
                Start free
              </LinkButton>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
