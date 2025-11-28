import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
              paths: ["/join/*"],
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

      // Redirect to deep link
      const deepLink = `goodtimes://join/${groupId}`
      
      // Return HTML redirect page (works better than HTTP redirect for app links)
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Redirecting...</title>
  <meta http-equiv="refresh" content="0;url=${deepLink}">
  <script>
    window.location.href = "${deepLink}";
  </script>
</head>
<body>
  <p>Redirecting to app...</p>
  <p>If you're not redirected, <a href="${deepLink}">click here</a>.</p>
</body>
</html>`

      return new Response(html, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html",
        },
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

