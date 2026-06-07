import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { YoutubeTranscript } from 'youtube-transcript'
import { translate } from '@vitalets/google-translate-api'
import { Database } from 'bun:sqlite'

// Cache: key = `${videoId}:${lang}:vi`
const transcriptCache = new Map<string, { text: string; duration: number; offset: number }[]>()

// SQLite setup
const db = new Database('lingotube.db', { create: true })
db.run(`
  CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`)
db.run('PRAGMA foreign_keys = ON')
db.run(`
  CREATE TABLE IF NOT EXISTS saved_subtitles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
    video_id TEXT NOT NULL,
    video_title TEXT NOT NULL DEFAULT '',
    text TEXT NOT NULL,
    translated TEXT NOT NULL DEFAULT '',
    lang TEXT NOT NULL DEFAULT 'en',
    offset INTEGER NOT NULL,
    duration INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`)

async function fetchAvailableLanguages(videoId: string): Promise<{ code: string; name: string }[]> {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { 'Accept-Language': 'en-US,en;q=0.9' },
  })
  const html = await res.text()
  const match = html.match(/"captionTracks":(\[.*?\])/)
  if (!match?.[1]) return []
  const tracks = JSON.parse(match[1]) as { languageCode: string; name: { simpleText: string } }[]
  const codeCounts = new Map<string, number>()
  return tracks.map(t => {
    const name = t.name.simpleText
    const count = codeCounts.get(t.languageCode) ?? 0
    codeCounts.set(t.languageCode, count + 1)
    const code = count === 0 ? t.languageCode : `${t.languageCode}:${count}`
    return { code, name }
  })
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
      const config = lang ? { lang: lang.split(':')[0] } : undefined
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
  // --- Folders ---
  .get('/folders', () => {
    const folders = db.query('SELECT * FROM folders ORDER BY created_at ASC').all() as any[]
    const subs = db.query('SELECT * FROM saved_subtitles ORDER BY created_at DESC').all() as any[]
    return { folders, subtitles: subs }
  })
  .post('/folders', ({ body }) => {
    const { name, parentId } = body as { name: string; parentId?: number }
    const result = db.query('INSERT INTO folders (name, parent_id) VALUES (?, ?) RETURNING *').get(name, parentId ?? null) as any
    return { data: result }
  })
  .patch('/folders/:id', ({ params, body }) => {
    const { name } = body as { name: string }
    db.run('UPDATE folders SET name = ? WHERE id = ?', [name, params.id])
    return { ok: true }
  })
  .delete('/folders/:id', ({ params }) => {
    db.run('PRAGMA foreign_keys = ON')
    db.run('DELETE FROM folders WHERE id = ?', [params.id])
    return { ok: true }
  })

  // --- Saved subtitles ---
  .post('/saved', ({ body }) => {
    const b = body as { folderId?: number; videoId: string; videoTitle: string; text: string; translated: string; lang: string; offset: number; duration: number }
    const result = db.query(
      'INSERT INTO saved_subtitles (folder_id, video_id, video_title, text, translated, lang, offset, duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *'
    ).get(b.folderId ?? null, b.videoId, b.videoTitle, b.text, b.translated, b.lang, b.offset, b.duration) as any
    return { data: result }
  })
  .patch('/saved/:id', ({ params, body }) => {
    const { folderId } = body as { folderId: number | null }
    db.run('UPDATE saved_subtitles SET folder_id = ? WHERE id = ?', [folderId ?? null, params.id])
    return { ok: true }
  })
  .delete('/saved/:id', ({ params }) => {
    db.run('DELETE FROM saved_subtitles WHERE id = ?', [params.id])
    return { ok: true }
  })

  .listen({ port: 3000, hostname: '0.0.0.0' })

console.log('Server running at http://localhost:3000')
