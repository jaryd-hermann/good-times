import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Extract groupId - try multiple methods to handle Vercel routing
  let groupId: string | undefined
  
  // Method 1: Try query parameter from [...path] catch-all route
  const { path } = req.query
  if (Array.isArray(path) && path.length > 0) {
    // For [...path], path is an array of segments
    // Join them in case there are multiple segments, then take first UUID
    const fullPath = path.join('/')
    const uuidMatch = fullPath.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
    const tokenMatch = fullPath.match(/(GT-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4,})/i)
    if (uuidMatch) {
      groupId = uuidMatch[1]
    } else if (tokenMatch) {
      groupId = tokenMatch[1].toUpperCase()
    } else {
      // Fallback: just take first segment
      groupId = path[0]
    }
  } else if (typeof path === 'string' && path) {
    groupId = path
  }
  
  // Method 2: Extract from URL if query param didn't work
  if (!groupId && req.url) {
    // Try multiple URL patterns
    const patterns = [
      /\/api\/proxy-join\/([^/?]+)/,
      /\/join\/([^/?]+)/,
      /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
    ]
    
    for (const pattern of patterns) {
      const match = req.url.match(pattern)
      if (match && match[1]) {
        groupId = match[1]
        break
      }
    }
  }
  
  // Debug logging
  console.log('[proxy-join] Request:', {
    url: req.url,
    queryPath: req.query.path,
    extractedGroupId: groupId,
    hasGroupId: !!groupId
  })

  // Clean up groupId
  if (groupId) {
    groupId = groupId.split('?')[0].split('#')[0].trim()
  }

  console.log('[proxy-join] Extracted groupId:', groupId)

  // Accept BOTH invite shapes:
  //   v1 — a group UUID
  //   v2 — an invite token like GT-97DP
  // Requiring a UUID meant every v2 invite link 400'd before it ever reached the
  // app. Charset matches the token generator (no I/O/0/1).
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const V2_TOKEN = /^GT-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4,}$/i

  if (!groupId || !(UUID.test(groupId) || V2_TOKEN.test(groupId))) {
    console.error('[proxy-join] Unrecognised invite id:', { groupId, url: req.url })
    // No debug payload in the response — this endpoint is public, and echoing the
    // raw request back to an anonymous caller is not something to ship.
    return res.status(404).send('Invite not found')
  }

  // Get Supabase anon key from environment variable
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  if (!supabaseAnonKey) {
    return res.status(500).json({ error: 'Supabase configuration missing' })
  }

  // Proxy request to Supabase Edge Function with auth header
  const supabaseUrl = `https://ytnnsykbgohiscfgomfe.supabase.co/functions/v1/join-redirect/join/${groupId}`
  
  console.log('[proxy-join] Calling Supabase:', { supabaseUrl, groupId })
  
  try {
    const response = await fetch(supabaseUrl, {
      method: req.method || 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
        'Content-Type': 'text/html',
      },
    })

    const html = await response.text()
    
    res.setHeader('Content-Type', 'text/html')
    res.status(response.status).send(html)
  } catch (error) {
    console.error('[proxy-join] Error:', error)
    res.status(500).json({ error: 'Failed to proxy request' })
  }
}

