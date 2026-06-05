import { useState } from 'react'
import YouTube from 'react-youtube'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

function extractVideoId(url: string): string | null {
  const patterns = [
    /[?&]v=([^&]+)/,
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

function App() {
  const [inputUrl, setInputUrl] = useState('')
  const [videoId, setVideoId] = useState<string | null>(null)
  const [error, setError] = useState('')

  function handleLoad() {
    const id = extractVideoId(inputUrl.trim())
    if (!id) {
      setError('URL không hợp lệ, vui lòng kiểm tra lại.')
      return
    }
    setError('')
    setVideoId(id)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleLoad()
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
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
              onKeyDown={handleKeyDown}
            />
            <Button onClick={handleLoad}>Tải video</Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Player */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center">
              {videoId ? (
                <YouTube
                  videoId={videoId}
                  opts={{ width: '100%', height: '100%', playerVars: { autoplay: 1 } }}
                  className="w-full h-full"
                  iframeClassName="w-full h-full"
                />
              ) : (
                <span className="text-muted-foreground text-sm">Video sẽ hiển thị ở đây</span>
              )}
            </div>

            {/* Current Subtitle */}
            <div className="border rounded-lg p-4 bg-card flex flex-col gap-2 min-h-[100px] items-center justify-center text-center">
              <p className="text-lg font-medium">Hello, how are you?</p>
              <Separator />
              <p className="text-muted-foreground">Xin chào, bạn có khỏe không?</p>
            </div>
          </div>

          {/* Subtitle List */}
          <div className="border rounded-lg overflow-hidden bg-card">
            <div className="px-4 py-3 border-b bg-muted/50">
              <span className="text-sm font-medium">Danh sách phụ đề</span>
            </div>
            <div className="overflow-y-auto max-h-[500px] divide-y">
              {[
                { time: '0:03', original: 'Hello, how are you?', translated: 'Xin chào, bạn có khỏe không?' },
                { time: '0:07', original: "I'm doing great, thanks!", translated: 'Tôi ổn lắm, cảm ơn!' },
                { time: '0:11', original: 'What are you up to today?', translated: 'Hôm nay bạn đang làm gì vậy?' },
                { time: '0:15', original: 'Just working on a new project.', translated: 'Tôi đang làm một dự án mới.' },
                { time: '0:20', original: 'That sounds interesting!', translated: 'Nghe có vẻ thú vị đấy!' },
              ].map((item, i) => (
                <div
                  key={i}
                  className={`px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${i === 0 ? 'bg-primary/10 border-l-2 border-l-primary' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xs text-muted-foreground mt-0.5 shrink-0">{item.time}</span>
                    <div className="flex flex-col gap-0.5">
                      <p className="text-sm">{item.original}</p>
                      <p className="text-xs text-muted-foreground">{item.translated}</p>
                    </div>
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
