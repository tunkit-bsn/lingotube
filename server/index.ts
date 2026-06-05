import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { YoutubeTranscript } from 'youtube-transcript'
import { translate } from '@vitalets/google-translate-api'

// Cache: key = `${videoId}:${lang}:vi`
const transcriptCache = new Map<string, { text: string; duration: number; offset: number }[]>()

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

async function translateBatch(texts: string[], to: string): Promise<string[]> {
  // Gộp thành 1 request, dùng ký tự phân cách hiếm gặp
  const SEPARATOR = '\n🔸\n'
  const joined = texts.join(SEPARATOR)
  const result = await translate(joined, { to })
  return result.text.split(SEPARATOR).map(s => s.trim())
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
    const q = query as Record<string, string>
    const lang = q.lang
    const translate_to = q.translate_to ?? 'vi'
    const cacheKey = `${params.videoId}:${lang}:${translate_to}`

    if (transcriptCache.has(cacheKey)) {
      return { data: transcriptCache.get(cacheKey), cached: true }
    }

    try {
      const config = lang ? { lang } : undefined
      const transcript = await YoutubeTranscript.fetchTranscript(params.videoId, config)

      const texts = transcript.map(l => l.text)
      const translated = await translateBatch(texts, translate_to)

      const data = transcript.map((l, i) => ({
        text: l.text,
        translated: translated[i] ?? '',
        duration: l.duration,
        offset: l.offset,
      }))

      transcriptCache.set(cacheKey, data)
      return { data, cached: false }
    } catch (e) {
      return { data: [], error: (e as Error).message }
    }
  })
  .listen({ port: 3000, hostname: '0.0.0.0' })

console.log('Server running at http://localhost:3000')
