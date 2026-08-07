import type { Metadata } from "next"
import { LegalPage } from "../components/legal"
import { CONTACT_EMAIL } from "@/lib/config"

export const metadata: Metadata = {
  title: "Terms of Service — Good Times",
  description: "The terms for using Good Times, the private daily-question app for your groups.",
}

const UPDATED = "August 2, 2026"

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated={UPDATED}>
      <p>
        Welcome to Good Times. These Terms of Service (&ldquo;Terms&rdquo;) are an agreement between you
        and Jaryd Hermann (&ldquo;Good Times,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) governing your use of the
        Good Times app and related services. By creating an account or using the app, you agree to
        these Terms. If you don&rsquo;t agree, please don&rsquo;t use the app.
      </p>

      <h2>Eligibility</h2>
      <p>
        You must be at least 13 years old to use Good Times. By using the app, you confirm that you
        meet this requirement and that the information you provide is accurate.
      </p>

      <h2>Your account</h2>
      <p>
        You&rsquo;re responsible for your account and for keeping your login secure. You&rsquo;re
        responsible for the activity that happens under your account. Let us know right away if you
        believe your account has been compromised.
      </p>

      <h2>Your content</h2>
      <p>
        You keep ownership of everything you create in Good Times — your answers, messages, photos,
        videos, and voice notes (&ldquo;your content&rdquo;). You grant us a limited, non-exclusive license
        to host, store, and display your content solely to operate the app and deliver it to the
        members of your groups. We don&rsquo;t claim ownership of your content and we don&rsquo;t use it
        for advertising.
      </p>
      <p>
        You&rsquo;re responsible for the content you share, and you confirm you have the right to share
        it.
      </p>

      <h2>Acceptable use</h2>
      <p>You agree not to use Good Times to:</p>
      <ul>
        <li>Harass, bully, threaten, or harm others.</li>
        <li>Post content that is illegal, hateful, or sexually exploitative, or that infringes someone else&rsquo;s rights.</li>
        <li>Share someone&rsquo;s private information without their consent.</li>
        <li>Attempt to access accounts, groups, or data that aren&rsquo;t yours.</li>
        <li>Disrupt, reverse-engineer, or abuse the app or its infrastructure, including through automated scraping.</li>
      </ul>
      <p>
        Good Times is intended for private groups of people who know each other. Respect the people
        in your groups.
      </p>

      <h2>Child safety</h2>
      <p>
        We have <strong>zero tolerance for child sexual abuse and exploitation (CSAE) and child
        sexual abuse material (CSAM).</strong> Such content and behavior are strictly prohibited and
        will result in removal, account termination, and reporting to the relevant authorities. See
        our <a href="/child-safety">Child Safety Standards</a> for details on what&rsquo;s prohibited,
        how to report a concern, and our point of contact.
      </p>

      <h2>Groups &amp; privacy</h2>
      <p>
        Content you post is shared with the members of the group you post it in. Please only add
        people you trust, and remember that other members can see and may save what you share. How we
        handle your data is described in our{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>Subscriptions &amp; payments</h2>
      <p>
        Good Times is free to download and use. We may offer an optional premium membership. If you
        purchase a subscription through the Apple App Store, payment and renewals are handled by
        Apple and are subject to Apple&rsquo;s terms. You can manage or cancel subscriptions in your
        App Store account settings.
      </p>

      <h2>Intellectual property</h2>
      <p>
        The Good Times name, logo, app, and design are owned by us and protected by intellectual
        property laws. These Terms don&rsquo;t grant you any right to use our branding without our
        permission.
      </p>

      <h2>Termination</h2>
      <p>
        You can stop using Good Times and delete your account at any time. We may suspend or terminate
        access if you violate these Terms or use the app in a way that could harm others or the
        service. Sections that by their nature should survive termination (such as content licenses
        you&rsquo;ve granted, disclaimers, and limitations of liability) will continue to apply.
      </p>

      <h2>Disclaimers</h2>
      <p>
        Good Times is provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo; We work hard to keep the app
        running well, but we don&rsquo;t promise it will always be uninterrupted, error-free, or
        secure. To the fullest extent permitted by law, we disclaim all warranties not expressly
        stated here.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, Good Times will not be liable for any indirect,
        incidental, special, or consequential damages, or for any loss of data or content, arising
        from your use of the app.
      </p>

      <h2>Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. When we make material changes, we&rsquo;ll update
        the &ldquo;last updated&rdquo; date above and, where appropriate, notify you in the app. Continuing
        to use the app after changes take effect means you accept the updated Terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these Terms? Email us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  )
}
