import Image from "next/image"
import { DownloadButton, DownloadModal, FloatingCTA } from "./components/download"
import { APP_STORE_URL } from "@/lib/config"

function DownloadCTA() {
  return (
    <div className="download">
      <div className="dl-col">
        <DownloadButton />
        <span className="store-hint">Free · iPhone · Android coming soon</span>
      </div>
    </div>
  )
}

/** A phone frame. Drop a real screenshot into /public/screens to replace the placeholder. */
function PhoneShot({ src, alt, placeholder }: { src?: string; alt: string; placeholder: string }) {
  return (
    <div className="shot">
      <div className="phone">
        {src ? (
          <img src={src} alt={alt} />
        ) : (
          <div className="phone-placeholder">
            <span>{placeholder}</span>
          </div>
        )}
      </div>
    </div>
  )
}

const TESTIMONIALS = [
  { name: "Allison", quote: "I thought this would be lame but I'm so hooked." },
  { name: "Julia", quote: "Literally better than our group chat." },
  { name: "Seth", quote: "It's the one notification I actually look forward to." },
  { name: "Elliot", quote: "I love having our own little space." },
  { name: "Shishir", quote: "Been off social for ages — this is such a nice way to stay close." },
  { name: "Lucy", quote: "One question a day and suddenly I know my friends again." },
  { name: "Emily", quote: "No ads, no randos. Just my people. Finally." },
  { name: "Michael", quote: "My group answers before coffee every morning now." },
  { name: "Rachel", quote: "It's like a daily inside-joke generator." },
  { name: "Allie", quote: "Way more real than anything on Instagram." },
  { name: "Judy", quote: "Even my mom gets it, and she hates apps." },
  { name: "Joe", quote: "Somehow this replaced three group chats." },
  { name: "Jonty", quote: "The voice notes crack me up every single day." },
]

const AVATAR_COLORS = [
  "var(--accent)",
  "var(--blue)",
  "var(--pink)",
  "var(--green)",
  "var(--purple)",
  "var(--red)",
]

function QuoteCard({ name, quote, i, hidden }: { name: string; quote: string; i: number; hidden?: boolean }) {
  return (
    <figure className="quote" aria-hidden={hidden}>
      <p>&ldquo;{quote}&rdquo;</p>
      <figcaption className="quote-by">
        <span className="avatar" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
          {name[0]}
        </span>
        <span className="quote-name">{name}</span>
      </figcaption>
    </figure>
  )
}

function Testimonials() {
  return (
    <div className="marquee" aria-label="What people are saying">
      <div className="marquee-track">
        {TESTIMONIALS.map((t, i) => (
          <QuoteCard key={t.name} name={t.name} quote={t.quote} i={i} />
        ))}
        {TESTIMONIALS.map((t, i) => (
          <QuoteCard key={`${t.name}-dup`} name={t.name} quote={t.quote} i={i} hidden />
        ))}
      </div>
    </div>
  )
}

const PILLARS = [
  {
    n: "1",
    title: "One new question, every day",
    body: "Every morning your group gets the same single question — thoughtful, silly, or somewhere in between. No feed to scroll, no blank page to stare at. Just one good prompt to spark the day.",
    chips: ["Curated daily", "Same question for everyone", "Zero pressure"],
    placeholder: "screens/question.png",
  },
  {
    n: "2",
    title: "Answer it however you want",
    body: "Type a line, record a voice note, drop a photo, or send a video. Answer in whatever way fits the moment — the point is to be real, not polished.",
    chips: ["📝 Text", "🎙 Voice", "📸 Photo", "🎥 Video"],
    placeholder: "screens/answer.png",
  },
  {
    n: "3",
    title: "Chat in private — your group space",
    body: "See everyone's answers side by side, then react and riff in a space that's just for your people. No likes, no followers, no strangers. Just your favorite humans.",
    chips: ["Private by default", "Your people only", "React & reply"],
    placeholder: "screens/private.png",
  },
]

export default function Home() {
  return (
    <>
      {/* ---------------- Hero ---------------- */}
      <section className="hero" id="hero">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <Image className="hero-mark" src="/wordmark.png" alt="Good Times" width={640} height={188} priority />
            <h1>Answer one question a&nbsp;day with friends</h1>
            <p className="hero-sub">The daily ritual that keeps your favorite people close.</p>
            <ul className="nolist">
              <li><span className="x">✕</span> No AI</li>
              <li><span className="x">✕</span> No Algorithms</li>
              <li><span className="x">✕</span> No Ads</li>
              <li><span className="x">✕</span> No Strangers</li>
            </ul>
            <DownloadCTA />
          </div>

          <div className="hero-art">
            <Image src="/hero.png" alt="Good Times app showing today's question answered with a photo, a voice note and a video" width={1084} height={1626} priority />
          </div>
        </div>
      </section>

      {/* ---------------- Problem ---------------- */}
      <section className="problem section">
        <div className="wrap section-head center">
          <h2>Social today sucks.</h2>
          <p>
            <span className="hl a">Ads everywhere.</span> <span className="hl">AI slop.</span>{" "}
            <span className="hl c">Algos feeding us.</span>{" "}
            <span className="hl b">Performance for strangers.</span> And group chats go static.
            It&rsquo;s just not easy to stay connected with your favorite people in a way that feels
            fun, light, <em>and</em> actually meaningful.
          </p>
        </div>
      </section>

      {/* ---------------- Pillars ---------------- */}
      <section className="section" id="how">
        <div className="wrap">
          <div className="section-head center">
            <h2>
              Good Times is private social
              <br />
              for groups.
            </h2>
            <ul className="yeslist">
              <li><span className="check">✓</span> Your ideas</li>
              <li><span className="check">✓</span> Your answers</li>
              <li><span className="check">✓</span> Your privacy</li>
              <li><span className="check">✓</span> Your people</li>
            </ul>
          </div>
        </div>

        <Testimonials />

        <div className="wrap">
          <div className="pillars">
            {PILLARS.map((p) => (
              <article className="pillar" key={p.n}>
                <div className="pillar-copy">
                  <div className="pillar-num">{p.n}</div>
                  <h3>{p.title}</h3>
                  <p>{p.body}</p>
                  <div className="chiprow">
                    {p.chips.map((c) => (
                      <span className="chip" key={c}>{c}</span>
                    ))}
                  </div>
                </div>
                <PhoneShot alt={p.title} placeholder={p.placeholder} />
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Big CTA (last section) ---------------- */}
      <section className="cta" id="download-cta">
        <div className="cta-inner">
          <Image className="cta-mark" src="/wordmark.png" alt="Good Times" width={640} height={188} />
          <h2>Answer today&rsquo;s question.</h2>
          <p>Add your group, and start connecting and having fun with your favorite people.</p>
          <DownloadCTA />
          <nav className="cta-links">
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
          </nav>
        </div>
      </section>

      <DownloadModal />
      <FloatingCTA />
    </>
  )
}
