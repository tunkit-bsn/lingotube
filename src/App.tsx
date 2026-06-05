import { useState, useRef, useEffect } from 'react'
import YouTube, { type YouTubePlayer } from 'react-youtube'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const API = 'http://localhost:3000'

interface Language { code: string; name: string }
interface TranscriptLine { text: string; duration: number; offset: number }

function extractVideoId(url: string): string | null {
  const patterns = [/[?&]v=([^&]+)/, /youtu\.be\/([^?&]+)/, /youtube\.com\/embed\/([^?&]+)/]
  for (const p of patterns) { const m = url.match(p); if (m) return m[1] }
  return null
}

function App() {
  const [inputUrl, setInputUrl] = useState('')
  const [videoId, setVideoId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const [languages, setLanguages] = useState<Language[]>([])
  const [selectedLang, setSelectedLang] = useState<string>('')
  const [transcript, setTranscript] = useState<TranscriptLine[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)

  const playerRef = useRef<YouTubePlayer | null>(null)
  const subtitleRefs = useRef<(HTMLDivElement | null)[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function handleLoad() {
    const id = extractVideoId(inputUrl.trim())
    if (!id) { setError('URL không hợp lệ, vui lòng kiểm tra lại.'); return }
    setError('')
    setVideoId(id)
    setTranscript([])
    setLanguages([])
    setSelectedLang('')
    setCurrentIndex(-1)

    const res = await fetch(`${API}/languages/${id}`)
    const json = await res.json() as { data: Language[] }
    setLanguages(json.data)
    if (json.data.length > 0) setSelectedLang(json.data[0].code)
  }

  async function handleLangChange(lang: string) {
    setSelectedLang(lang)
    if (!videoId) return
    const res = await fetch(`${API}/transcript/${videoId}?lang=${lang}`)
    const json = await res.json() as { data: TranscriptLine[] }
    setTranscript(json.data)
    setCurrentIndex(-1)
  }

  useEffect(() => {
    if (selectedLang && videoId) handleLangChange(selectedLang)
  }, [selectedLang])

  function startSync() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(async () => {
      if (!playerRef.current) return
      const time = (await playerRef.current.getCurrentTime()) * 1000
      const idx = transcript.findLastIndex(l => l.offset <= time)
      if (idx !== currentIndex) setCurrentIndex(idx)
    }, 300)
  }

  function stopSync() {
    if (intervalRef.current) clearInterval(intervalRef.current)
  }

  useEffect(() => {
    if (currentIndex >= 0) {
      subtitleRefs.current[currentIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [currentIndex])

  useEffect(() => () => stopSync(), [])

  const current = currentIndex >= 0 ? transcript[currentIndex] : null

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold">LinguaTube</span>
          <Badge variant="secondary">Beta</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge>Tiếng Anh</Badge>
          <Badge variant="outline">Tiếng Trung</Badge>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-6">
        {/* URL Input */}
        <div className="flex flex-col gap-1">
          <div className="flex gap-2">
            <Input
              placeholder="Nhập URL YouTube... (vd: https://youtube.com/watch?v=...)"
              className="flex-1"
              value={inputUrl}
              onChange={e => setInputUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLoad()}
            />
            <Button onClick={handleLoad}>Tải video</Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video + subtitle display */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center">
              {videoId ? (
                <YouTube
                  videoId={videoId}
                  opts={{ width: '100%', height: '100%', playerVars: { autoplay: 1 } }}
                  className="w-full h-full"
                  iframeClassName="w-full h-full"
                  onReady={e => { playerRef.current = e.target }}
                  onPlay={() => startSync()}
                  onPause={() => stopSync()}
                  onEnd={() => stopSync()}
                />
              ) : (
                <span className="text-muted-foreground text-sm">Video sẽ hiển thị ở đây</span>
              )}
            </div>

            {/* Current subtitle */}
            <div className="border rounded-lg p-4 bg-card flex flex-col gap-2 min-h-[100px] items-center justify-center text-center">
              {current ? (
                <>
                  <p className="text-lg font-medium">{current.text}</p>
                  <Separator />
                  <p className="text-muted-foreground text-sm italic">Bản dịch sẽ hiển thị ở đây</p>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">Phụ đề sẽ hiển thị ở đây</p>
              )}
            </div>
          </div>

          {/* Subtitle list */}
          <div className="border rounded-lg overflow-hidden bg-card flex flex-col">
            <div className="px-4 py-3 border-b bg-muted/50 flex items-center justify-between gap-2">
              <span className="text-sm font-medium shrink-0">Phụ đề</span>
              {languages.length > 0 && (
                <Select value={selectedLang} onValueChange={handleLangChange}>
                  <SelectTrigger className="h-7 text-xs w-auto">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map(l => (
                      <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="overflow-y-auto flex-1 max-h-[500px] divide-y">
              {transcript.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {videoId ? 'Đang tải phụ đề...' : 'Tải video để xem phụ đề'}
                </div>
              ) : transcript.map((line, i) => (
                <div
                  key={i}
                  ref={el => { subtitleRefs.current[i] = el }}
                  onClick={() => playerRef.current?.seekTo(line.offset / 1000, true)}
                  className={`px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${i === currentIndex ? 'bg-primary/10 border-l-2 border-l-primary' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xs text-muted-foreground mt-0.5 shrink-0">
                      {Math.floor(line.offset / 60000)}:{String(Math.floor((line.offset % 60000) / 1000)).padStart(2, '0')}
                    </span>
                    <p className="text-sm">{line.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
