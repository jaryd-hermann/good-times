import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let entryId: string | undefined

  const { path } = req.query
  if (Array.isArray(path) && path.length > 0) {
    const fullPath = path.join('/')
    const uuidMatch = fullPath.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
    if (uuidMatch) {
      entryId = uuidMatch[1]
    } else {
      entryId = path[0]
    }
  } else if (typeof path === 'string' && path) {
    entryId = path
  }

  if (!entryId && req.url) {
    const patterns = [
      /\/api\/proxy-share\/([^/?]+)/,
      /\/share\/([^/?]+)/,
      /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    ]
    for (const pattern of patterns) {
      const match = req.url.match(pattern)
      if (match && match[1]) {
        entryId = match[1]
        break
      }
    }
  }

  if (entryId) {
    entryId = entryId.split('?')[0].split('#')[0].trim()
  }

  if (!entryId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entryId)) {
    return res.status(400).json({ error: 'Invalid entry ID' })
  }

  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  if (!supabaseAnonKey) {
    return res.status(500).json({ error: 'Supabase configuration missing' })
  }

  const supabaseUrl = `https://ytnnsykbgohiscfgomfe.supabase.co/functions/v1/join-redirect/share/${entryId}`

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
    console.error('[proxy-share] Error:', error)
    res.status(500).json({ error: 'Failed to proxy request' })
  }
}
