import { signIn } from "./actions"

export const dynamic = "force-dynamic"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const sp = await searchParams
  const error = sp.error

  return (
    <div className="login-wrap">
      <form action={signIn} className="login-card">
        <div className="brand" style={{ fontSize: 20 }}>
          Good&nbsp;Times <span className="brand-sub">curation</span>
        </div>
        <p className="sub" style={{ margin: "6px 0 20px" }}>
          Sign in with an authorized account.
        </p>

        {error ? (
          <div className="banner err" style={{ marginBottom: 16 }}>
            {error}
          </div>
        ) : null}

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            required
            autoFocus
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
          />
        </label>

        <button type="submit" style={{ width: "100%", marginTop: 8 }}>
          Sign in
        </button>
      </form>
    </div>
  )
}
