import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  text: string
  lang: string
  isLooping: boolean
  onToggleLoop: () => void
  onReplay: () => void
  onComplete: () => void
}

function isCJK(lang: string) {
  return lang.startsWith('zh') || lang.startsWith('ja') || lang.startsWith('ko')
}

function tokenizeAll(text: string): string[] {
  return text.match(/[a-zA-Z0-9']+|[^a-zA-Z0-9'\s]+/g) ?? []
}

function tokenizeWords(text: string, lang: string): string[] {
  if (isCJK(lang)) return text.replace(/\s+/g, '').split('')
  return text.match(/[a-zA-Z0-9']+/g) ?? []
}

function reconstruct(answerWords: string[], text: string, lang: string): string {
  if (isCJK(lang)) return answerWords.join('')
  const all = tokenizeAll(text)
  let wi = 0
  return all.map(t => /[a-zA-Z0-9']/.test(t) ? (answerWords[wi++] ?? '') : t).join('')
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface Token { id: number; word: string }

export function WordOrder({ text, lang, isLooping, onToggleLoop, onReplay, onComplete }: Props) {
  const [pool, setPool] = useState<Token[]>([])
  const [answer, setAnswer] = useState<Token[]>([])
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null)

  useEffect(() => {
    const tokens = tokenizeWords(text, lang).map((word, i) => ({ id: i, word }))
    setPool(shuffle(tokens))
    setAnswer([])
    setResult(null)
  }, [text])

  function pickFromPool(token: Token) {
    if (result) return
    setPool(p => p.filter(t => t.id !== token.id))
    setAnswer(a => {
      const next = [...a, token]
      check(next)
      return next
    })
  }

  function returnToPool(token: Token) {
    if (result) return
    setAnswer(a => a.filter(t => t.id !== token.id))
    setPool(p => shuffle([...p, token]))
    setResult(null)
  }

  function check(current: Token[]) {
    const words = tokenizeWords(text, lang)
    if (current.length < words.length) return
    const expected = isCJK(lang) ? text.replace(/\s+/g, '') : tokenizeAll(text).join('')
    const isCorrect = reconstruct(current.map(t => t.word), text, lang) === expected
    setResult(isCorrect ? 'correct' : 'wrong')
    if (isCorrect) setTimeout(onComplete, 800)
  }

  function reset() {
    const tokens = tokenizeWords(text, lang).map((word, i) => ({ id: i, word }))
    setPool(shuffle(tokens))
    setAnswer([])
    setResult(null)
  }

  const answerColor =
    result === 'correct' ? 'border-green-500 bg-green-500/5' :
    result === 'wrong' ? 'border-red-400 bg-red-500/5' :
    'border-border bg-muted/30'

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex items-center gap-2 justify-center">
        <Button size="sm" variant="outline" onClick={onReplay}>↺ Phát lại</Button>
        <Button size="sm" variant={isLooping ? 'default' : 'outline'} onClick={onToggleLoop}>
          ⟳ {isLooping ? 'Tắt lặp' : 'Lặp lại'}
        </Button>
        {result === 'wrong' && (
          <Button size="sm" variant="outline" onClick={reset}>↩ Thử lại</Button>
        )}
      </div>

      {/* Answer row */}
      <div className={`min-h-[48px] rounded-lg border-2 px-3 py-2 flex flex-wrap gap-2 items-center justify-center transition-colors ${answerColor}`}>
        {answer.length === 0
          ? <span className="text-xs text-muted-foreground">Nhấn vào từ bên dưới để sắp xếp</span>
          : answer.map(token => (
            <button
              key={token.id}
              onClick={() => returnToPool(token)}
              className="px-2.5 py-1 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted transition-colors disabled:opacity-60"
              disabled={!!result}
            >
              {token.word}
            </button>
          ))
        }
      </div>

      {/* Pool */}
      <div className="flex flex-wrap gap-2 justify-center">
        {pool.map(token => (
          <button
            key={token.id}
            onClick={() => pickFromPool(token)}
            className="px-2.5 py-1 rounded-md border border-border bg-muted text-sm font-medium hover:bg-muted/70 transition-colors"
          >
            {token.word}
          </button>
        ))}
      </div>
    </div>
  )
}
