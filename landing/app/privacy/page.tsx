import type { Metadata } from "next"
import { LegalPage } from "../components/legal"
import { CONTACT_EMAIL } from "@/lib/config"

export const metadata: Metadata = {
  title: "Privacy Policy — Good Times",
  description: "How Good Times handles your data. Your groups are private by default — no ads, no selling your data.",
}

const UPDATED = "August 2, 2026"

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated={UPDATED}>
      <p>
        Good Times is a private, group-based app for staying connected with the people you
        choose. This policy explains what we collect, why, and the choices you have. The short
        version: <strong>your groups are private, we don&rsquo;t run ads, and we don&rsquo;t sell your
        data.</strong>
      </p>

      <h2>Who we are</h2>
      <p>
        Good Times (&ldquo;we,&rdquo; &ldquo;us,&rdquo; the &ldquo;app&rdquo;) is operated by Jaryd Hermann. If you have any
        questions about this policy or your data, contact us at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account information.</strong> Your email address, and your name and profile photo
          if you provide them. If you sign in with Apple or Google, we receive basic account details
          from that provider (such as your name and email).
        </li>
        <li>
          <strong>Content you create.</strong> The answers, messages, photos, videos, voice notes,
          reactions, and other content you add to your groups.
        </li>
        <li>
          <strong>Group information.</strong> The groups you create or join and who is in them, so we
          can deliver the daily question and everyone&rsquo;s answers to the right people.
        </li>
        <li>
          <strong>Device &amp; usage basics.</strong> A push notification token (if you enable
          notifications), app version, device type, and basic diagnostic and usage information used to
          run and improve the app.
        </li>
      </ul>
      <p>
        We do <strong>not</strong> use tracking-based advertising, and we don&rsquo;t build advertising
        profiles about you.
      </p>

      <h2>How we use your information</h2>
      <ul>
        <li>To provide the core experience — delivering the daily question and sharing answers within your private groups.</li>
        <li>To send notifications you&rsquo;ve asked for (like a new daily question or a reply in your group).</li>
        <li>To keep the app secure, prevent abuse, and fix bugs.</li>
        <li>To communicate with you about your account or important changes.</li>
      </ul>
      <p>
        Some features use optional device permissions — your camera, microphone, photo library, and
        contacts. These are only used when you choose to use the related feature (for example,
        recording a video reply or inviting a friend), and you can manage them anytime in your device
        settings.
      </p>

      <h2>How your content is shared</h2>
      <p>
        Content you post is shared only with the members of the group you post it in. Good Times is
        not a public social network — there are no public profiles, no followers, and nothing is
        public by default.
      </p>

      <h2>Service providers</h2>
      <p>
        We use a small number of trusted providers to run the app, and they only process data on our
        behalf:
      </p>
      <ul>
        <li><strong>Supabase</strong> — database, authentication, and file storage.</li>
        <li><strong>OneSignal</strong> — sending push notifications.</li>
        <li><strong>Apple &amp; Google</strong> — app distribution and optional sign-in.</li>
        <li><strong>OpenAI</strong> — optional voice-to-text transcription when you record a spoken answer.</li>
      </ul>
      <p>We do not sell your personal information.</p>

      <h2>Data retention &amp; deletion</h2>
      <p>
        We keep your information for as long as your account is active. You can delete your content or
        your account at any time from within the app. When you delete your account, we remove your
        personal information and content from our active systems, except where we need to retain
        limited data to comply with legal obligations or resolve disputes. To request deletion or a
        copy of your data, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>Your choices &amp; rights</h2>
      <ul>
        <li>Access, correct, or delete your information from within the app or by contacting us.</li>
        <li>Turn notifications and device permissions on or off at any time.</li>
        <li>
          Depending on where you live, you may have additional rights (such as under GDPR or CCPA),
          including the right to access, port, or delete your data. We honor these requests — just
          reach out.
        </li>
      </ul>

      <h2>Children</h2>
      <p>
        Good Times is not directed to children under 13, and we don&rsquo;t knowingly collect personal
        information from them. If you believe a child has provided us information, contact us and
        we&rsquo;ll delete it.
      </p>

      <h2>Security</h2>
      <p>
        We use industry-standard measures, including encryption in transit, to protect your
        information. No method of transmission or storage is 100% secure, but we work to protect your
        data and continually improve our safeguards.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this policy from time to time. When we make material changes, we&rsquo;ll update
        the &ldquo;last updated&rdquo; date above and, where appropriate, notify you in the app.
      </p>

      <h2>Contact</h2>
      <p>
        Questions? Email us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  )
}
