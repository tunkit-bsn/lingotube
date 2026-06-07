import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import YouTube, { type YouTubePlayer } from 'react-youtube'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PenLine, Shuffle, Mic, Bookmark } from 'lucide-react'
import { RubyText } from '@/components/RubyText'
import { DictationMode } from '@/components/DictationMode'
import { WordOrder } from '@/components/WordOrder'
import { SpeakingMode } from '@/components/SpeakingMode'

const API = 'http://localhost:3000'

interface Language { code: string; name: string }
interface TranscriptLine { text: string; translated: string; duration: number; offset: number }

function extractVideoId(url: string): string | null {
  const patterns = [/[?&]v=([^&]+)/, /youtu\.be\/([^?&]+)/, /youtube\.com\/embed\/([^?&]+)/]
  for (const p of patterns) { const m = url.match(p); if (m) return m[1] }
  return null
}

function renderFolderTree(
  folders: { id: number; parent_id: number | null; name: string }[],
  parentId: number | null,
  depth: number,
  onSelect: (id: number) => void
): React.ReactNode {
  return folders
    .filter(f => f.parent_id === parentId)
    .map(f => (
      <div key={f.id}>
        <button
          onClick={() => onSelect(f.id)}
          className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors"
          style={{ paddingLeft: `${12 + depth * 14}px` }}
        >
          {f.name}
        </button>
        {renderFolderTree(folders, f.id, depth + 1, onSelect)}
      </div>
    ))
}

function App() {
  const [inputUrl, setInputUrl] = useState('')
  const [videoId, setVideoId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const [videoTitle, setVideoTitle] = useState('')
  const [languages, setLanguages] = useState<Language[]>([])
  const [selectedLang, setSelectedLang] = useState<string>('')
  const [transcript, setTranscript] = useState<TranscriptLine[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [isLooping, setIsLooping] = useState(false)
  const [isDictation, setIsDictation] = useState(false)
  const [isWordOrder, setIsWordOrder] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)

  const playerRef = useRef<YouTubePlayer | null>(null)
  const subtitleRefs = useRef<(HTMLDivElement | null)[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const transcriptRef = useRef<TranscriptLine[]>([])
  const currentIndexRef = useRef(-1)
  const isLoopingRef = useRef(false)
  const isDictationRef = useRef(false)
  const isWordOrderRef = useRef(false)
  const isSpeakingRef = useRef(false)

  useEffect(() => { transcriptRef.current = transcript }, [transcript])
  useEffect(() => { currentIndexRef.current = currentIndex }, [currentIndex])
  useEffect(() => { isLoopingRef.current = isLooping }, [isLooping])
  useEffect(() => { isDictationRef.current = isDictation }, [isDictation])
  useEffect(() => { isWordOrderRef.current = isWordOrder }, [isWordOrder])
  useEffect(() => { isSpeakingRef.current = isSpeaking }, [isSpeaking])

  async function handleLoad() {
    const id = extractVideoId(inputUrl.trim())
    if (!id) { setError('URL không hợp lệ, vui lòng kiểm tra lại.'); return }
    setError('')
    setVideoId(id)
    setTranscript([])
    setLanguages([])
    setSelectedLang('')
    setCurrentIndex(-1)
    setIsLooping(false)
    setIsDictation(false)

    const res = await fetch(`${API}/languages/${id}`)
    const json = await res.json() as { data: Language[] }
    setLanguages(json.data)
    if (json.data.length > 0) setSelectedLang(json.data[0].code)
  }

  async function handleLangChange(lang: string) {
    setSelectedLang(lang)
    if (!videoId) return
    const res = await fetch(`${API}/transcript/${videoId}?lang=${lang}&translate_to=vi`)
    const json = await res.json() as { data: TranscriptLine[] }
    setTranscript(json.data)
    setCurrentIndex(-1)
  }

  useEffect(() => {
    if (selectedLang && videoId) handleLangChange(selectedLang)
  }, [selectedLang])

  function seekToLine(index: number) {
    const lines = transcriptRef.current
    if (index < 0 || index >= lines.length) return
    playerRef.current?.seekTo(lines[index].offset / 1000, true)
    playerRef.current?.playVideo()
    setCurrentIndex(index)
  }

  function seekRelative(deltaSeconds: number) {
    if (!playerRef.current) return
    const idx = currentIndexRef.current
    const lines = transcriptRef.current
    const t = playerRef.current.getCurrentTime() * 1000
    let targetMs = t + deltaSeconds * 1000

    if ((isDictationRef.current || isWordOrderRef.current || isSpeakingRef.current) && idx >= 0) {
      const line = lines[idx]
      const start = line.offset
      const end = line.offset + line.duration - 50
      targetMs = Math.min(Math.max(targetMs, start), end)
    }

    playerRef.current.seekTo(targetMs / 1000, true)
    playerRef.current.playVideo()
  }

  function startSync() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(async () => {
      if (!playerRef.current) return
      const time = (await playerRef.current.getCurrentTime()) * 1000
      const lines = transcriptRef.current
      const idx = currentIndexRef.current

      if (isLoopingRef.current && idx >= 0) {
        const line = lines[idx]
        const end = line.offset + line.duration
        if (time >= end) {
          playerRef.current.seekTo(line.offset / 1000, true)
          playerRef.current.playVideo()
          return
        }
        return
      }

      if ((isDictationRef.current || isWordOrderRef.current || isSpeakingRef.current) && idx >= 0) {
        const line = lines[idx]
        const end = line.offset + line.duration
        if (time >= end) {
          playerRef.current.pauseVideo()
          return
        }
      }

      const newIdx = lines.findLastIndex(l => l.offset <= time)
      if (newIdx !== idx) setCurrentIndex(newIdx)
    }, 200)
  }

  function stopSync() {
    if (intervalRef.current) clearInterval(intervalRef.current)
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA'

    // Alt+R: replay current subtitle from anywhere (including input fields)
    if (e.altKey && e.key.toLowerCase() === 'r') {
      e.preventDefault()
      const idx = currentIndexRef.current
      if (idx >= 0) seekToLine(idx)
      return
    }

    // arrow keys: work everywhere except when typing in URL input (not dictation inputs)
    const isUrlInput = isInput && !(e.target as HTMLElement).closest('[data-dictation]')

    const idx = currentIndexRef.current
    const lines = transcriptRef.current
    const dictation = isDictationRef.current || isWordOrderRef.current || isSpeakingRef.current

    switch (e.key) {
      case 'ArrowUp':
        if (isUrlInput) return
        e.preventDefault()
        seekRelative(-2)
        break
      case 'ArrowDown':
        if (isUrlInput) return
        e.preventDefault()
        seekRelative(2)
        break
      case 'ArrowLeft':
        if (isUrlInput) return
        e.preventDefault()
        if (idx > 0) seekToLine(idx - 1)
        break
      case 'ArrowRight':
        if (isUrlInput) return
        e.preventDefault()
        if (idx < lines.length - 1) seekToLine(idx + 1)
        break
    }

    if (isInput) return

    switch (e.key.toLowerCase()) {
      case 'a':
        if (dictation) return
        e.preventDefault()
        if (idx > 0) seekToLine(idx - 1)
        break
      case 'd':
        if (dictation) return
        e.preventDefault()
        if (idx < lines.length - 1) seekToLine(idx + 1)
        break
      case 'r':
        e.preventDefault()
        if (idx >= 0) seekToLine(idx)
        break
      case 's':
        e.preventDefault()
        setIsLooping(prev => !prev)
        startSync()
        break
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    if (currentIndex >= 0) {
      subtitleRefs.current[currentIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [currentIndex])

  useEffect(() => () => stopSync(), [])

  const [folders, setFolders] = useState<{ id: number; parent_id: number | null; name: string }[]>([])
  const [showSavePopup, setShowSavePopup] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  async function loadFolders() {
    const res = await fetch(`${API}/folders`)
    const json = await res.json() as { folders: { id: number; parent_id: number | null; name: string }[] }
    setFolders(json.folders)
  }

  function openSavePopup() {
    if (!current) return
    loadFolders()
    setShowSavePopup(true)
    setSaveSuccess(false)
  }

  async function saveSubtitle(folderId?: number) {
    if (!current || !videoId) return
    await fetch(`${API}/saved`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folderId: folderId ?? null,
        videoId,
        videoTitle,
        text: current.text,
        translated: current.translated,
        lang: selectedLang,
        offset: current.offset,
        duration: current.duration,
      }),
    })
    setSaveSuccess(true)
    setTimeout(() => setShowSavePopup(false), 800)
  }

  const current = currentIndex >= 0 ? transcript[currentIndex] : null
  const isChinese = selectedLang.startsWith('zh')
  const canDictate = !!current
  const canPractice = !!current
  const activeMode = isDictation ? 'dictation' : isWordOrder ? 'wordorder' : isSpeaking ? 'speaking' : null

  const keyHints = isDictation
    ? [
      { key: '↑', label: 'Tua lại 2s' },
      { key: '↓', label: 'Tua tới 2s' },
      { key: '←', label: 'Câu trước' },
      { key: '→', label: 'Câu sau' },
      { key: 'Alt+R', label: 'Phát lại' },
      { key: 'S', label: isLooping ? 'Tắt lặp' : 'Lặp lại', active: isLooping },
    ]
    : [
      { key: 'A / ←', label: 'Câu trước' },
      { key: 'D / →', label: 'Câu sau' },
      { key: '↑', label: 'Tua lại 2s' },
      { key: '↓', label: 'Tua tới 2s' },
      { key: 'R / Alt+R', label: 'Phát lại' },
      { key: 'S', label: isLooping ? 'Tắt lặp' : 'Lặp lại', active: isLooping },
    ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold">LinguaTube</span>
          <Badge variant="secondary">Beta</Badge>
        </div>
        <Link to="/saved" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Đã lưu
        </Link>
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
                  onReady={e => { playerRef.current = e.target; setVideoTitle(e.target.getVideoData()?.title ?? '') }}
                  onPlay={() => startSync()}
                  onPause={() => stopSync()}
                  onEnd={() => stopSync()}
                />
              ) : (
                <span className="text-muted-foreground text-sm">Video sẽ hiển thị ở đây</span>
              )}
            </div>

            {/* Current subtitle / Dictation */}
            <div className="border rounded-lg p-4 bg-card flex flex-col gap-3 min-h-[120px] justify-center relative">
              <div className="absolute top-2 right-3 flex items-center gap-2">
                {isLooping && !activeMode && (
                  <span className="text-xs text-primary font-medium">⟳ Lặp lại</span>
                )}
                {current && (
                  <button
                    onClick={openSavePopup}
                    title="Lưu phụ đề này"
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Bookmark size={15} />
                  </button>
                )}
              </div>

              {canDictate && (
                <div className="absolute top-2 left-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={isDictation ? 'default' : 'outline'}
                    className="h-8 text-xs px-3 gap-1.5"
                    onClick={() => { setIsDictation(p => !p); setIsWordOrder(false); setIsSpeaking(false) }}
                  >
                    <PenLine size={13} />
                    Chép chính tả
                  </Button>
                  <Button
                    size="sm"
                    variant={isWordOrder ? 'default' : 'outline'}
                    className="h-8 text-xs px-3 gap-1.5"
                    onClick={() => { setIsWordOrder(p => !p); setIsDictation(false); setIsSpeaking(false) }}
                  >
                    <Shuffle size={13} />
                    Sắp xếp từ
                  </Button>
                  <Button
                    size="sm"
                    variant={isSpeaking ? 'default' : 'outline'}
                    className="h-8 text-xs px-3 gap-1.5"
                    onClick={() => { setIsSpeaking(p => !p); setIsDictation(false); setIsWordOrder(false) }}
                  >
                    <Mic size={13} />
                    Luyện nói
                  </Button>
                </div>
              )}

              <div className={canPractice ? 'mt-6' : ''}>
                {isDictation && current ? (
                  <div data-dictation>
                    <DictationMode
                      text={current.text}
                      translation={current.translated}
                      lang={selectedLang}
                      isLooping={isLooping}
                      onToggleLoop={() => { setIsLooping(p => !p); startSync() }}
                      onReplay={() => seekToLine(currentIndexRef.current)}
                      onComplete={() => {
                        const idx = currentIndexRef.current
                        const lines = transcriptRef.current
                        if (idx < 0 || idx >= lines.length) return
                        seekToLine(idx)
                        setTimeout(() => {
                          if (idx + 1 < lines.length) seekToLine(idx + 1)
                        }, lines[idx].duration + 300)
                      }}
                    />
                  </div>
                ) : isWordOrder && current ? (
                  <div data-dictation>
                    <WordOrder
                      text={current.text}
                      lang={selectedLang}
                      isLooping={isLooping}
                      onToggleLoop={() => { setIsLooping(p => !p); startSync() }}
                      onReplay={() => seekToLine(currentIndexRef.current)}
                      onComplete={() => {
                        const idx = currentIndexRef.current
                        const lines = transcriptRef.current
                        if (idx < 0 || idx >= lines.length) return
                        seekToLine(idx)
                        setTimeout(() => {
                          if (idx + 1 < lines.length) seekToLine(idx + 1)
                        }, lines[idx].duration + 300)
                      }}
                    />
                  </div>
                ) : isSpeaking && current ? (
                  <div data-dictation>
                    <SpeakingMode
                      text={current.text}
                      translation={current.translated}
                      lang={selectedLang}
                      isLooping={isLooping}
                      onToggleLoop={() => { setIsLooping(p => !p); startSync() }}
                      onReplay={() => seekToLine(currentIndexRef.current)}
                      onMicStart={() => playerRef.current?.pauseVideo()}
                      onMicStop={() => playerRef.current?.playVideo()}
                    />
                  </div>
                ) : current ? (
                  <div className="flex flex-col gap-2 items-center text-center">
                    <p className="text-lg font-medium">
                      {isChinese ? <RubyText text={current.text} /> : current.text}
                    </p>
                    <Separator />
                    <p className="text-muted-foreground">{current.translated}</p>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm text-center">Phụ đề sẽ hiển thị ở đây</p>
                )}
              </div>
            </div>

            {/* Keyboard hints */}
            <div className="flex gap-3 justify-center flex-wrap">
              {keyHints.map(({ key, label, active }) => (
                <div key={key} className={`flex items-center gap-1.5 text-xs ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                  <kbd className={`px-1.5 py-0.5 rounded border font-mono text-xs ${active ? 'border-primary bg-primary/10' : 'border-border bg-muted'}`}>{key}</kbd>
                  <span>{label}</span>
                </div>
              ))}
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
                  onClick={() => seekToLine(i)}
                  className={`px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${i === currentIndex ? 'bg-primary/10 border-l-2 border-l-primary' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xs text-muted-foreground mt-0.5 shrink-0">
                      {Math.floor(line.offset / 60000)}:{String(Math.floor((line.offset % 60000) / 1000)).padStart(2, '0')}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <p className="text-sm">
                        {isChinese ? <RubyText text={line.text} /> : line.text}
                      </p>
                      {line.translated && <p className="text-xs text-muted-foreground">{line.translated}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Save popup */}
      {showSavePopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowSavePopup(false)} />
          <div className="relative bg-card border rounded-xl shadow-xl p-5 w-80 flex flex-col gap-3">
            {saveSuccess ? (
              <p className="text-center text-sm text-green-600 font-medium py-2">Đã lưu thành công!</p>
            ) : (
              <>
                <p className="text-sm font-medium">Lưu vào thư mục</p>
                <div className="flex flex-col gap-0.5 max-h-64 overflow-y-auto">
                  <button
                    onClick={() => saveSubtitle(undefined)}
                    className="text-left px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors text-muted-foreground"
                  >
                    Không phân loại
                  </button>
                  {folders.length > 0 && <div className="border-t my-1" />}
                  {renderFolderTree(folders, null, 0, saveSubtitle)}
                </div>
                {folders.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center">Chưa có thư mục nào. Tạo thư mục ở trang Đã lưu.</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
