import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { PageFrame } from "@/components/marketing/page-frame";
import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <>
      <PageFrame />
      <MarketingNav />
      <main className="flex-1">
        <section className="mx-auto flex max-w-3xl flex-col items-center px-6 py-32 text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-brand-light">
            404
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">
            This page isn&rsquo;t in stock.
          </h1>
          <p className="mt-4 text-lg text-foreground-muted">
            The page you&rsquo;re looking for doesn&rsquo;t exist or has moved.
          </p>
          <div className="mt-8 flex gap-3">
            <LinkButton href="/">Back to home</LinkButton>
            <LinkButton href="/dashboard" variant="secondary">
              Go to dashboard
            </LinkButton>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
