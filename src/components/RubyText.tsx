import { pinyin } from 'pinyin-pro'

interface Props {
  text: string
}

export function RubyText({ text }: Props) {
  const tokens = pinyin(text, { toneType: 'symbol', type: 'all' })

  return (
    <span>
      {tokens.map((token, i) =>
        token.isZh ? (
          <ruby key={i} className="mx-0.5">
            {token.origin}
            <rt className="text-[0.65em] text-muted-foreground font-normal">{token.pinyin}</rt>
          </ruby>
        ) : (
          <span key={i}>{token.origin}</span>
        )
      )}
    </span>
  )
}
