import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  text: string
  translation?: string
  lang: string
  isLooping: boolean
  onToggleLoop: () => void
  onReplay: () => void
  onComplete: () => void
}

interface WordState {
  word: string
  value: string
  status: 'idle' | 'correct' | 'wrong' | 'revealed'
}

function isCJK(lang: string) {
  return lang.startsWith('zh') || lang.startsWith('ja') || lang.startsWith('ko')
}

function tokenize(text: string, lang: string): string[] {
  if (isCJK(lang)) return text.replace(/\s+/g, '').split('')
  return text.match(/[a-zA-Z']+|[^a-zA-Z'\s]+/g) ?? []
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z']/g, '')
}

export function DictationMode({ text, translation, lang, isLooping, onToggleLoop, onReplay, onComplete }: Props) {
  const [words, setWords] = useState<WordState[]>([])
  const [showTranslation, setShowTranslation] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    const tokens = tokenize(text, lang)
    setWords(tokens.map(w => ({ word: w, value: '', status: 'idle' })))
    inputRefs.current = []
    // focus first word input after render
    setTimeout(() => inputRefs.current[0]?.focus(), 50)
  }, [text])

  const cjk = isCJK(lang)

  function isInputToken(word: string) {
    return cjk ? true : /[a-zA-Z']/.test(word)
  }

  function matchWord(value: string, word: string) {
    return cjk ? value === word : normalize(value) === normalize(word)
  }

  function checkComplete(updated: WordState[]) {
    const inputWords = updated.filter(w => isInputToken(w.word))
    const allDone = inputWords.every(w => w.status !== 'idle')
    if (allDone) setTimeout(onComplete, 600)
  }

  function handleChange(i: number, value: string) {
    if (!isInputToken(words[i].word)) return

    setWords(prev => {
      const next = [...prev]
      next[i] = { ...next[i], value }
      return next
    })

    if (matchWord(value, words[i].word)) {
      setWords(prev => {
        const next = [...prev]
        next[i] = { ...next[i], value, status: 'correct' }
        checkComplete(next)
        return next
      })
      focusNext(i)
    }
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Tab') {
      e.preventDefault()
      revealWord(i)
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      focusNext(i)
    }
    if (e.key === 'Backspace' && words[i].value === '') {
      e.preventDefault()
      focusPrev(i)
    }
  }

  function revealWord(i: number) {
    setWords(prev => {
      const next = [...prev]
      next[i] = { ...next[i], value: next[i].word, status: 'revealed' }
      checkComplete(next)
      return next
    })
    focusNext(i)
  }

  function focusNext(i: number) {
    for (let j = i + 1; j < words.length; j++) {
      if (isInputToken(words[j].word) && words[j].status === 'idle') {
        inputRefs.current[j]?.focus()
        return
      }
    }
  }

  function focusPrev(i: number) {
    for (let j = i - 1; j >= 0; j--) {
      if (isInputToken(words[j].word)) {
        inputRefs.current[j]?.focus()
        return
      }
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Controls */}
      <div className="flex items-center gap-2 justify-center">
        <Button size="sm" variant="outline" onClick={onReplay}>
          ↺ Phát lại
        </Button>
        <Button
          size="sm"
          variant={isLooping ? 'default' : 'outline'}
          onClick={onToggleLoop}
        >
          ⟳ {isLooping ? 'Tắt lặp' : 'Lặp lại'}
        </Button>
        {translation && (
          <Button size="sm" variant={showTranslation ? 'default' : 'outline'} onClick={() => setShowTranslation(p => !p)}>
            Dịch
          </Button>
        )}
      </div>

      {showTranslation && translation && (
        <p className="text-center text-sm text-muted-foreground">{translation}</p>
      )}

      {/* Word inputs */}
      <div className="flex flex-wrap gap-x-1.5 gap-y-3 justify-center items-end">
        {words.map((w, i) => {
          if (!isInputToken(w.word)) {
            return (
              <span key={i} className="text-lg text-muted-foreground self-end pb-1">
                {w.word}
              </span>
            )
          }

          const borderColor =
            w.status === 'correct' ? 'border-green-500' :
            w.status === 'wrong' ? 'border-red-500' :
            w.status === 'revealed' ? 'border-yellow-500' :
            'border-border'

          const textColor =
            w.status === 'correct' ? 'text-green-600' :
            w.status === 'wrong' ? 'text-red-600' :
            w.status === 'revealed' ? 'text-yellow-600' :
            'text-foreground'

          return (
            <div key={i} className="flex flex-col items-center gap-0.5">
              {/* show correct word above if wrong/revealed */}
              {(w.status === 'wrong' || w.status === 'revealed') && (
                <span className="text-xs text-muted-foreground line-through">{w.word}</span>
              )}
              <input
                ref={el => { inputRefs.current[i] = el }}
                value={w.value}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                disabled={w.status === 'correct' || w.status === 'wrong' || w.status === 'revealed'}
                style={{ width: cjk ? '2.2ch' : `${Math.max(w.word.length, 2) + 1}ch` }}
                className={`
                  border-b-2 border-t-0 border-l-0 border-r-0 rounded-none bg-transparent
                  text-center text-base outline-none px-0.5 py-0.5
                  disabled:opacity-100 disabled:cursor-default
                  ${borderColor} ${textColor}
                `}
              />
            </div>
          )
        })}
      </div>

      {/* Hint */}
      <p className="text-center text-xs text-muted-foreground">
        <kbd className="px-1 py-0.5 rounded border border-border bg-muted font-mono text-xs">Tab</kbd> để xem gợi ý từ hiện tại
      </p>
    </div>
  )
}
