import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, MicOff, Eye, EyeOff, Play } from 'lucide-react'

interface Props {
  text: string
  translation: string
  lang: string
  isLooping: boolean
  onToggleLoop: () => void
  onReplay: () => void
  onMicStart: () => void
  onMicStop: () => void
}

interface WordResult {
  word: string
  correct: boolean
}

function isCJK(lang: string) {
  return lang.startsWith('zh') || lang.startsWith('ja') || lang.startsWith('ko')
}

function normalizeLatin(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9']/g, '')
}

function tokenizeLatin(text: string): string[] {
  return text.match(/[a-zA-Z0-9']+/g) ?? []
}

function tokenizeCJK(text: string): string[] {
  // split into individual non-space chars (handles hanzi, kana, kanji, hangul)
  return text.replace(/\s+/g, '').split('')
}

function compareWords(original: string, spoken: string, lang: string): WordResult[] {
  if (isCJK(lang)) {
    const origChars = tokenizeCJK(original)
    const spokenChars = tokenizeCJK(spoken)
    return origChars.map((ch, i) => ({
      word: ch,
      correct: (spokenChars[i] ?? '') === ch,
    }))
  }
  const origWords = tokenizeLatin(original)
  const spokenWords = tokenizeLatin(spoken)
  return origWords.map((word, i) => ({
    word,
    correct: normalizeLatin(spokenWords[i] ?? '') === normalizeLatin(word),
  }))
}

const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

function toSpeechLang(lang: string): string {
  if (lang.startsWith('zh')) return lang.includes('TW') || lang.includes('HK') ? 'zh-TW' : 'zh-CN'
  if (lang.startsWith('ja')) return 'ja-JP'
  if (lang.startsWith('ko')) return 'ko-KR'
  if (lang.startsWith('fr')) return 'fr-FR'
  if (lang.startsWith('de')) return 'de-DE'
  if (lang.startsWith('es')) return 'es-ES'
  return 'en-US'
}

export function SpeakingMode({ text, translation, lang, isLooping, onToggleLoop, onReplay, onMicStart, onMicStop }: Props) {
  const [isListening, setIsListening] = useState(false)
  const [results, setResults] = useState<WordResult[] | null>(null)
  const [showOriginal, setShowOriginal] = useState(true)
  const [showTranslation, setShowTranslation] = useState(false)
  const [unsupported, setUnsupported] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [spokenText, setSpokenText] = useState<string | null>(null)
  const recognitionRef = useRef<InstanceType<typeof SpeechRecognition> | null>(null)
  const spokenPartsRef = useRef<string[]>([])
  const shouldCheckRef = useRef(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!SpeechRecognition) setUnsupported(true)
  }, [])

  // Reset results when sentence changes
  useEffect(() => {
    setResults(null)
    setSpokenText(null)
    setAudioUrl(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    stopListening(false)
  }, [text])

  async function startListening() {
    if (!SpeechRecognition) return

    // Start audio recording
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      audioChunksRef.current = []
      recorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setAudioUrl(prev => {
          if (prev) URL.revokeObjectURL(prev)
          return URL.createObjectURL(blob)
        })
        stream.getTracks().forEach(t => t.stop())
      }
      recorder.start()
      mediaRecorderRef.current = recorder
    } catch {
      // mic permission denied — still allow speech recognition attempt
    }

    const recognition = new SpeechRecognition()
    recognition.lang = toSpeechLang(lang)
    recognition.continuous = true
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          spokenPartsRef.current.push(e.results[i][0].transcript)
        }
      }
    }
    recognition.onerror = () => { setIsListening(false) }
    recognition.onstart = () => { setSpokenText(null) }
    recognition.onend = () => {
      setIsListening(false)
      if (shouldCheckRef.current) {
        shouldCheckRef.current = false
        const spoken = spokenPartsRef.current.join(' ').trim()
        if (spoken) {
          setSpokenText(spoken)
          setResults(compareWords(text, spoken, lang))
        }
        spokenPartsRef.current = []
      }
    }

    recognitionRef.current = recognition
    spokenPartsRef.current = []
    shouldCheckRef.current = false
    recognition.start()
    setIsListening(true)
    setResults(null)
    onMicStart()
  }

  function stopListening(doCheck = false, notify = false) {
    shouldCheckRef.current = doCheck
    recognitionRef.current?.stop()
    recognitionRef.current = null
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }
    if (notify) onMicStop()
  }

  function toggleMic() {
    if (isListening) stopListening(true, true)
    else startListening()
  }

  function playback() {
    if (!audioUrl) return
    if (!audioRef.current) audioRef.current = new Audio()
    audioRef.current.src = audioUrl
    audioRef.current.play()
  }

  if (unsupported) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Trình duyệt không hỗ trợ Web Speech API. Vui lòng dùng Chrome hoặc Edge.
      </p>
    )
  }

  const accuracy = results
    ? Math.round((results.filter(r => r.correct).length / results.length) * 100)
    : null

  return (
    <div className="flex flex-col gap-4 items-center">
      {/* Controls */}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={onReplay}>↺ Phát lại</Button>
        <Button size="sm" variant={isLooping ? 'default' : 'outline'} onClick={onToggleLoop}>
          ⟳ {isLooping ? 'Tắt lặp' : 'Lặp lại'}
        </Button>
        <Button size="sm" variant={showOriginal ? 'default' : 'outline'} onClick={() => setShowOriginal(p => !p)}>
          {showOriginal ? <Eye size={13} /> : <EyeOff size={13} />}
          Phụ đề
        </Button>
        <Button size="sm" variant={showTranslation ? 'default' : 'outline'} onClick={() => setShowTranslation(p => !p)}>
          {showTranslation ? <Eye size={13} /> : <EyeOff size={13} />}
          Dịch
        </Button>
      </div>

      {/* Original text */}
      {showOriginal && (
        <p className="text-base font-medium text-center">{text}</p>
      )}

      {/* Translation */}
      {showTranslation && (
        <p className="text-sm text-muted-foreground text-center">{translation}</p>
      )}

      {/* Mic button + playback */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleMic}
          className={`
            w-14 h-14 rounded-full flex items-center justify-center transition-all
            ${isListening
              ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 scale-110 animate-pulse'
              : 'bg-primary text-primary-foreground hover:opacity-90'}
          `}
        >
          {isListening ? <MicOff size={22} /> : <Mic size={22} />}
        </button>

        {audioUrl && !isListening && (
          <button
            onClick={playback}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-muted hover:bg-muted/70 transition-colors"
            title="Nghe lại giọng của bạn"
          >
            <Play size={18} />
          </button>
        )}
      </div>

      {/* Result */}
      {results && (
        <div className="flex flex-col items-center gap-3 w-full">
          {/* Spoken text */}
          {spokenText && (
            <div className="w-full rounded-md bg-muted/50 px-3 py-2">
              <p className="text-xs text-muted-foreground mb-1">Bạn nói:</p>
              <p className="text-sm">{spokenText}</p>
            </div>
          )}

          {/* Answer comparison */}
          <div className="w-full rounded-md bg-muted/50 px-3 py-2">
            <p className="text-xs text-muted-foreground mb-1">Đáp án:</p>
            <div className="flex flex-wrap gap-x-1.5 gap-y-1">
              {results.map((r, i) => (
                <span
                  key={i}
                  className={`text-sm font-medium px-1 rounded ${r.correct ? 'text-green-600' : 'text-red-500'}`}
                >
                  {r.word}
                </span>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">Độ chính xác: {accuracy}%</p>
        </div>
      )}
    </div>
  )
}
