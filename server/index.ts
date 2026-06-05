import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { YoutubeTranscript } from 'youtube-transcript'

async function fetchAvailableLanguages(videoId: string): Promise<{ code: string; name: string }[]> {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { 'Accept-Language': 'en-US,en;q=0.9' },
  })
  const html = await res.text()
  const match = html.match(/"captionTracks":(\[.*?\])/)
  if (!match?.[1]) return []
  const tracks = JSON.parse(match[1]) as { languageCode: string; name: { simpleText: string } }[]
  return tracks.map(t => ({ code: t.languageCode, name: t.name.simpleText }))
}

new Elysia()
  .use(cors())
  .get('/health', () => ({ ok: true }))
  .get('/languages/:videoId', async ({ params }) => {
    try {
      const langs = await fetchAvailableLanguages(params.videoId)
      return { data: langs }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  })
  .get('/transcript/:videoId', async ({ params, query }) => {
    const lang = (query as Record<string, string>).lang
    try {
      const config = lang ? { lang } : undefined
      const transcript = await YoutubeTranscript.fetchTranscript(params.videoId, config)
      return { data: transcript }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  })
  .listen({ port: 3000, hostname: '0.0.0.0' })

console.log('Server running at http://localhost:3000')
