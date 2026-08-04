import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const APP_STORE_URL = "https://apps.apple.com/app/good-times/id6743445632"
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.goodtimes.app"
const SUPABASE_FUNCTIONS_URL = "https://ytnnsykbgohiscfgomfe.supabase.co/functions/v1"
/** Shown in og:image / link previews; served from thegoodtimes.app (see public/loading.png). */
const DEFAULT_OG_IMAGE_URL = "https://thegoodtimes.app/loading.png"

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/)
  if (words.length <= maxWords) return text.trim()
  return words.slice(0, maxWords).join(" ") + "..."
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    // Extract pathname, handling both direct calls and proxied calls
    // Direct via Supabase: /functions/v1/join-redirect/join/abc123 -> /join/abc123
    // Direct function call: /join-redirect/join/abc123 -> /join/abc123
    // Proxied: /join/abc123 -> /join/abc123
    let pathname = url.pathname
    console.log("[join-redirect] Original pathname:", pathname, "Full URL:", req.url)
    
    // Strip known function path prefixes
    if (pathname.startsWith("/functions/v1/join-redirect")) {
      pathname = pathname.replace("/functions/v1/join-redirect", "")
    } else if (pathname.startsWith("/join-redirect")) {
      // Handle direct function calls (without /functions/v1 prefix)
      pathname = pathname.replace("/join-redirect", "")
    }
    
    // Ensure pathname starts with / if it doesn't
    if (!pathname.startsWith("/")) {
      pathname = "/" + pathname
    }
    
    // Normalize pathname (remove trailing slashes except for root)
    pathname = pathname.replace(/\/+$/, "") || "/"
    
    console.log("[join-redirect] Processed pathname:", pathname)

    // Handle iOS Universal Links verification file
    if (pathname === "/.well-known/apple-app-site-association") {
      // TODO: Replace YOUR_TEAM_ID with your actual Apple Developer Team ID
      // Get it from: https://developer.apple.com/account or run: eas credentials --platform ios
      // Format: TEAM_ID.BUNDLE_ID (e.g., "ABC123XYZ.com.jarydhermann.goodtimes")
      const aasa = {
        applinks: {
          apps: [],
          details: [
            {
              appID: "38NFF5BY78.com.jarydhermann.goodtimes",
              paths: ["/join/*", "/share/*"],
            },
          ],
        },
      }

      return new Response(JSON.stringify(aasa), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      })
    }

    // Handle Android App Links verification file
    if (pathname === "/.well-known/assetlinks.json") {
      const assetlinks = [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: "com.goodtimes.app",
            sha256_cert_fingerprints: [
              "37:FB:01:1F:DC:9E:BA:BC:E3:D8:96:3F:36:CD:E8:E3:EB:FE:76:B9:B7:8E:D5:7D:15:74:44:3C:DC:3C:83:CE",
            ],
          },
        },
      ]

      return new Response(JSON.stringify(assetlinks), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      })
    }

    // Handle join group redirect
    if (pathname.startsWith("/join/")) {
      const groupId = pathname.split("/join/")[1]?.split("?")[0]?.split("/")[0]

      if (!groupId) {
        return new Response("Invalid group ID", {
          status: 400,
          headers: corsHeaders,
        })
      }

      const deepLink = `goodtimes://join/${groupId}`
      const canonicalUrl = `https://thegoodtimes.app/join/${groupId}`

      let ogTitle = "You’ve been invited to join a group on Good Times"
      let ogDescription = "Join your people. Answer today’s question"

      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        )

        // The path segment is an INVITE TOKEN ("GT-FX6G"), not a group id. This
        // looked it up as groups.id — a uuid column — so every v2 link raised
        // "invalid input syntax for type uuid", the catch swallowed it, and the
        // page silently fell back to generic copy. No invite has ever shown a
        // group name.
        const { data: invite } = await supabase
          .from("invite_tokens")
          .select("group_id")
          .eq("token", groupId)
          .maybeSingle()

        const resolvedGroupId = (invite as { group_id?: string } | null)?.group_id
        if (resolvedGroupId) {
          const { data: group } = await supabase
            .from("groups")
            .select("name")
            .eq("id", resolvedGroupId)
            .maybeSingle()
          const rawName = (group as { name?: string } | null)?.name?.trim()
          if (rawName) {
            ogTitle = `You’ve been invited to join “${rawName}” on Good Times`
          }
        }
      } catch (e) {
        console.warn("[join-redirect] optional group lookup failed:", e)
      }

      const ogTitleAttr = escapeHtml(ogTitle)
      const ogDescriptionAttr = escapeHtml(ogDescription)

      // Do NOT use meta refresh to goodtimes:// — without the app installed, Safari immediately
      // follows the custom scheme, fails, and shows a generic "Something went wrong" page
      // before users see any fallback. Match /share/: Open Graph for crawlers + delayed deep
      // link + store fallback when the app does not open (visibility still "visible").
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${ogTitleAttr}</title>
  <meta name="description" content="${ogDescriptionAttr}" />
  <meta name="apple-itunes-app" content="app-id=6743445632, app-argument=${escapeHtml(canonicalUrl)}" />
  <meta property="og:site_name" content="Good Times" />
  <meta property="og:title" content="${ogTitleAttr}" />
  <meta property="og:description" content="${ogDescriptionAttr}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:image" content="${escapeHtml(DEFAULT_OG_IMAGE_URL)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${ogTitleAttr}" />
  <meta name="twitter:description" content="${ogDescriptionAttr}" />
  <meta name="twitter:image" content="${escapeHtml(DEFAULT_OG_IMAGE_URL)}" />
  <script>
    (function () {
      var deepLink = ${JSON.stringify(deepLink)};
      var appStoreUrl = ${JSON.stringify(APP_STORE_URL)};
      var playStoreUrl = ${JSON.stringify(PLAY_STORE_URL)};
      var isAndroid = /Android/i.test(navigator.userAgent || "");
      var storeUrl = isAndroid ? playStoreUrl : appStoreUrl;

      var navigatedAway = false;
      function markAway() {
        navigatedAway = true;
      }
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden") markAway();
      });
      window.addEventListener("pagehide", markAway);

      // Brief delay so crawlers and Safari see real HTML/OG tags (not only "Redirecting...").
      window.setTimeout(function () {
        window.location.href = deepLink;
      }, 400);

      window.setTimeout(function () {
        if (navigatedAway) return;
        window.location.href = storeUrl;
      }, 2800);
    })();
  </script>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #E8E0D5; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0;">
  <div style="text-align: center; padding: 40px; max-width: 420px;">
    <h1 style="color: #000; font-size: 22px; margin: 0 0 12px;">Good Times</h1>
    <p style="color: #404040; margin: 0 0 8px;">Opening the app…</p>
    <p style="color: #404040; font-size: 15px; line-height: 1.45; margin: 0 0 20px;">${ogDescriptionAttr}</p>
    <p style="margin: 0 0 12px;">
      <a href="${escapeHtml(deepLink)}" style="color: #3A5F8C; font-weight: 600;">Open in app</a>
    </p>
    <p style="color: #404040; font-size: 14px; margin: 0;">
      Don’t have the app?
      <a href="${escapeHtml(APP_STORE_URL)}" style="color: #3A5F8C;">iPhone / iPad</a>
      ·
      <a href="${escapeHtml(PLAY_STORE_URL)}" style="color: #3A5F8C;">Android</a>
    </p>
  </div>
</body>
</html>`

      return new Response(html, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
        },
      })
    }

    // Handle share entry redirect
    if (pathname.startsWith("/share/")) {
      const entryId = pathname.split("/share/")[1]?.split("?")[0]?.split("/")[0]

      if (!entryId) {
        return new Response("Invalid entry ID", { status: 400, headers: corsHeaders })
      }

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      )

      const { data: entry } = await supabase
        .from("entries")
        .select(`
          id, text_content, date, group_id,
          prompt:prompts(question)
        `)
        .eq("id", entryId)
        .maybeSingle()

      const question = escapeHtml((entry?.prompt as any)?.question || "A question from Good Times")
      const answerPreview = escapeHtml(truncateWords(entry?.text_content || "", 12))
      const ogImageUrl = `${SUPABASE_FUNCTIONS_URL}/share-og-image?entryId=${entryId}`
      const deepLink = `goodtimes://share/${entryId}`

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${question} - Good Times</title>
  <meta property="og:title" content="${question}" />
  <meta property="og:description" content="${answerPreview}" />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="https://thegoodtimes.app/share/${entryId}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${question}" />
  <meta name="twitter:description" content="${answerPreview}" />
  <meta name="twitter:image" content="${ogImageUrl}" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script>
    // Try to open the app, fall back to App Store
    var deepLink = "${deepLink}";
    var appStoreUrl = "${APP_STORE_URL}";
    var start = Date.now();
    window.location.href = deepLink;
    setTimeout(function() {
      if (Date.now() - start < 3000) {
        window.location.href = appStoreUrl;
      }
    }, 2000);
  </script>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #E8E0D5; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0;">
  <div style="text-align: center; padding: 40px;">
    <h2 style="color: #000; margin-bottom: 8px;">Good Times</h2>
    <p style="color: #404040;">Opening in app...</p>
    <p style="color: #404040; font-size: 14px;">If the app doesn't open, <a href="${APP_STORE_URL}" style="color: #3A5F8C;">download it here</a>.</p>
  </div>
</body>
</html>`

      return new Response(html, {
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      })
    }

    // 404 for other paths
    return new Response("Not found", {
      status: 404,
      headers: corsHeaders,
    })
  } catch (error) {
    console.error("[join-redirect] Error:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    })
  }
})

