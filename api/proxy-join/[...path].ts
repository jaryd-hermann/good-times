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
    if (uuidMatch) {
      groupId = uuidMatch[1]
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

  // Validate groupId format (UUID)
  if (!groupId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(groupId)) {
    console.error('[proxy-join] Invalid groupId format:', { groupId, path, url: req.url, query: req.query })
    // Temporarily return debug info to see what's happening
    return res.status(400).json({ 
      error: 'Invalid group ID',
      debug: {
        groupId: groupId || 'undefined',
        path: path || 'undefined',
        url: req.url || 'undefined',
        query: req.query,
        queryKeys: Object.keys(req.query)
      }
    })
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

