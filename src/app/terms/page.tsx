import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { PageFrame } from "@/components/marketing/page-frame";

export const metadata = {
  title: "Terms of Service — invii.ai",
};

export default function TermsPage() {
  return (
    <>
      <PageFrame />
      <MarketingNav />
      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-6 py-24">
          <p className="text-sm font-medium uppercase tracking-wider text-brand-light">
            Legal
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-foreground-muted">
            Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </p>

          <div className="mt-8 flex flex-col gap-6 text-base leading-relaxed text-foreground-muted">
            <section>
              <h2 className="text-lg font-semibold text-foreground">1. Agreement to terms</h2>
              <p className="mt-2">
                By creating an account or using invii.ai (&ldquo;the
                Service&rdquo;), you agree to these Terms of Service. If you
                don&rsquo;t agree, don&rsquo;t use the Service. If you&rsquo;re
                using the Service on behalf of a business, you&rsquo;re
                agreeing on that business&rsquo;s behalf and confirming you
                have authority to do so.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">2. The Service</h2>
              <p className="mt-2">
                invii.ai helps businesses track inventory across locations,
                generate reorder suggestions, and optionally auto-charge
                saved payment methods for approved reorders. You&rsquo;re
                responsible for the accuracy of the inventory data you enter
                or import, and for reviewing reorder suggestions before
                approving them.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">3. Accounts and trials</h2>
              <p className="mt-2">
                New workspaces get a free trial period. After the trial ends,
                continued use of paid features requires an active
                subscription billed through Stripe. You&rsquo;re responsible
                for keeping your account credentials secure and for all
                activity under your account.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">4. Billing and auto-reorder charges</h2>
              <p className="mt-2">
                Subscription fees are billed on a recurring basis until
                canceled. If you enable auto-reorder on a product, invii.ai
                will charge your saved payment method automatically when that
                product hits its reorder point, without further confirmation
                from you. You can disable auto-reorder per product, or remove
                your payment method, at any time in Settings.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">5. Vendor ordering</h2>
              <p className="mt-2">
                invii.ai may store vendor portal credentials you provide, for
                your own reference. invii.ai does not place vendor orders on
                your behalf unless a feature explicitly says otherwise at the
                time you use it. You are responsible for placing and
                confirming orders with your vendors.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">6. Acceptable use</h2>
              <p className="mt-2">
                Don&rsquo;t misuse the Service — this includes attempting to
                access other workspaces&rsquo; data, disrupting the Service,
                or using it for anything unlawful.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">7. Termination</h2>
              <p className="mt-2">
                You can cancel your subscription or delete your workspace at
                any time in Settings. We may suspend or terminate accounts
                that violate these terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">8. Disclaimer and liability</h2>
              <p className="mt-2">
                The Service is provided &ldquo;as is.&rdquo; Reorder
                suggestions and auto-charges are based on the data you
                provide and may be inaccurate. You&rsquo;re responsible for
                reviewing them. To the extent permitted by law, invii.ai
                isn&rsquo;t liable for indirect or consequential damages
                arising from use of the Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">9. Changes</h2>
              <p className="mt-2">
                We may update these terms from time to time. Continued use of
                the Service after a change means you accept the updated
                terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">10. Contact</h2>
              <p className="mt-2">
                Questions about these terms? Contact us through the details
                on our homepage.
              </p>
            </section>

            <p className="mt-4 rounded-xl border border-border-hairline bg-surface px-4 py-3 text-sm">
              This is a general template and hasn&rsquo;t been reviewed by a
              lawyer. Have it reviewed for your business and jurisdiction
              before relying on it.
            </p>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
