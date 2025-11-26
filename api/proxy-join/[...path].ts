import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { path } = req.query
  const pathArray = Array.isArray(path) ? path : [path]
  const groupId = pathArray[0]

  if (!groupId) {
    return res.status(400).json({ error: 'Invalid group ID' })
  }

  // Get Supabase anon key from environment variable
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  if (!supabaseAnonKey) {
    return res.status(500).json({ error: 'Supabase configuration missing' })
  }

  // Proxy request to Supabase Edge Function with auth header
  const supabaseUrl = `https://ytnnsykbgohiscfgomfe.supabase.co/functions/v1/join-redirect/join/${groupId}`
  
  try {
    const response = await fetch(supabaseUrl, {
      method: req.method || 'GET',
      headers: {
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

