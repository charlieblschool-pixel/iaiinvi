import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { PageFrame } from "@/components/marketing/page-frame";

export const metadata = {
  title: "Privacy Policy — invii.ai",
};

export default function PrivacyPage() {
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
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-foreground-muted">
            Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </p>

          <div className="mt-8 flex flex-col gap-6 text-base leading-relaxed text-foreground-muted">
            <section>
              <h2 className="text-lg font-semibold text-foreground">1. What we collect</h2>
              <p className="mt-2">
                When you create a workspace, we collect your name, email
                address, and business name. If you sign in with Google, we
                receive your name, email, and profile image from Google. When
                you use the Service, we store the inventory, vendor, and
                location data you enter or import, and records of reorder
                suggestions and approvals.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">2. Payment information</h2>
              <p className="mt-2">
                Billing is handled by Stripe. We don&rsquo;t store your card
                number — Stripe stores it and gives us a token we use to
                charge your saved payment method for subscription fees and
                approved (or auto-approved) reorders.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">3. Vendor portal credentials</h2>
              <p className="mt-2">
                If you choose to save a vendor portal login, the password is
                encrypted at rest and is never shown back to you or anyone
                else after you save it.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">4. How we use your data</h2>
              <p className="mt-2">
                We use your data to operate the Service: tracking stock,
                generating reorder suggestions, processing payments, and
                communicating with you about your account (like reorder
                approvals or billing issues). We don&rsquo;t sell your data.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">5. Data sharing</h2>
              <p className="mt-2">
                We share data with service providers who help us run
                invii.ai — for example, our database host, and Stripe for
                payments and Google for sign-in, if you use those features.
                We don&rsquo;t share your data with anyone else except as
                required by law.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">6. Data retention and deletion</h2>
              <p className="mt-2">
                We keep your data for as long as your workspace is active.
                You can delete your workspace at any time in Settings, which
                removes your organization&rsquo;s data from the Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">7. Your rights</h2>
              <p className="mt-2">
                You can access, correct, or delete most of your data directly
                in the product. For anything else, contact us through the
                details on our homepage.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">8. Changes</h2>
              <p className="mt-2">
                We may update this policy from time to time. We&rsquo;ll
                update the date at the top of this page when we do.
              </p>
            </section>

            <p className="mt-4 rounded-xl border border-border-hairline bg-surface px-4 py-3 text-sm">
              This is a general template and hasn&rsquo;t been reviewed by a
              lawyer. Have it reviewed for your business and jurisdiction —
              and against any regulations that apply to you (like GDPR or
              CCPA) — before relying on it.
            </p>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
