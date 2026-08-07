import type { Metadata } from "next"
import { LegalPage } from "../components/legal"
import { CHILD_SAFETY_EMAIL, CHILD_SAFETY_CONTACT_NAME, CONTACT_EMAIL } from "@/lib/config"

export const metadata: Metadata = {
  title: "Child Safety Standards — Good Times",
  description:
    "Good Times has zero tolerance for child sexual abuse and exploitation (CSAE) and child sexual abuse material (CSAM). Read our child safety standards.",
}

const UPDATED = "August 6, 2026"

export default function ChildSafety() {
  return (
    <LegalPage title="Child Safety Standards" updated={UPDATED}>
      <p>
        Good Times, operated by {CHILD_SAFETY_CONTACT_NAME}, is committed to protecting children and
        keeping our app free of child sexual abuse and exploitation. We have{" "}
        <strong>zero tolerance for child sexual abuse and exploitation (CSAE) and child sexual abuse
        material (CSAM).</strong> These standards describe how we prevent, detect, and respond to it,
        in line with Google Play&rsquo;s Child Safety Standards policy and applicable laws.
      </p>

      <h2>What is prohibited</h2>
      <p>
        The following are strictly prohibited on Good Times, without exception:
      </p>
      <ul>
        <li>
          <strong>Child sexual abuse material (CSAM)</strong> — any visual depiction (including
          photos, videos, or computer-generated imagery) of a minor engaging in sexually explicit
          conduct.
        </li>
        <li>
          <strong>Child sexual abuse and exploitation (CSAE)</strong> — any content or behavior that
          sexually exploits, abuses, or endangers a child, including grooming, sextortion, trafficking,
          or otherwise sexually exploiting a minor.
        </li>
        <li>
          Any attempt to solicit, facilitate, or normalize the above, or to contact a minor for these
          purposes.
        </li>
      </ul>

      <h2>How we prevent and respond</h2>
      <p>
        Good Times is a private, invitation-based app intended for small groups of people who already
        know one another — there is no public feed, no follower graph, and no matching with strangers.
        When we become aware of CSAE or CSAM, we act promptly to:
      </p>
      <ul>
        <li>Remove the offending content.</li>
        <li>Disable and ban the responsible account(s).</li>
        <li>
          Preserve the relevant information and <strong>report to the National Center for Missing &amp;
          Exploited Children (NCMEC)</strong> and/or the appropriate authorities, as required by law.
        </li>
        <li>Cooperate with law enforcement investigations.</li>
      </ul>

      <h2>Reporting a concern</h2>
      <p>
        If you encounter content or behavior that endangers a child, please report it immediately:
      </p>
      <ul>
        <li>
          <strong>In the app:</strong> use the in-app reporting and feedback tools to flag content, a
          message, or a user, or to contact us — no need to leave the app.
        </li>
        <li>
          <strong>By email:</strong> contact us at{" "}
          <a href={`mailto:${CHILD_SAFETY_EMAIL}`}>{CHILD_SAFETY_EMAIL}</a>. We review child-safety
          reports as a priority.
        </li>
      </ul>
      <p>
        If a child is in immediate danger, contact your local law enforcement right away. In the
        United States, you can also report to the NCMEC CyberTipline at{" "}
        <a href="https://report.cybertip.org" target="_blank" rel="noopener noreferrer">
          report.cybertip.org
        </a>
        .
      </p>

      <h2>Compliance with laws</h2>
      <p>
        We comply with applicable child safety laws and act in accordance with these published
        standards. Our practices are informed by the{" "}
        <a href="https://www.technologycoalition.org/" target="_blank" rel="noopener noreferrer">
          Tech Coalition&rsquo;s
        </a>{" "}
        best practices for combating online child sexual exploitation and abuse.
      </p>

      <h2>Minimum age</h2>
      <p>
        Good Times is not directed to children. You must be at least 13 years old to use the app, as
        described in our <a href="/terms">Terms of Service</a>.
      </p>

      <h2>Child safety point of contact</h2>
      <p>
        For questions about these standards or our child-safety practices, our designated point of
        contact is:
      </p>
      <ul>
        <li><strong>{CHILD_SAFETY_CONTACT_NAME}</strong></li>
        <li>
          <a href={`mailto:${CHILD_SAFETY_EMAIL}`}>{CHILD_SAFETY_EMAIL}</a>
        </li>
      </ul>
      <p>
        For all other inquiries, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  )
}
