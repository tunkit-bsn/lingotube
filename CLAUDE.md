# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Frontend** (root directory, Node/npm):
```bash
npm run dev       # Start Vite dev server with HMR
npm run build     # TypeScript check + Vite bundle
npm run lint      # ESLint
npm run preview   # Preview production build
```

**Backend** (`server/` directory, Bun runtime):
```bash
bun run index.ts  # Start Elysia API server on port 3000
```

Both must run simultaneously for the full app to work. The frontend hardcodes `http://localhost:3000` as the API base ([src/App.tsx:11](src/App.tsx#L11)).

## Architecture

LinguaTube is a language learning app that synchronizes YouTube video playback with interactive subtitles and dictation exercises.

### Frontend (`src/`)

**`App.tsx`** is the monolithic core — it owns all state (video URL, transcript, playback sync, language selection, dictation mode) and orchestrates the full learning flow. Key logic:
- Fetches available caption languages from the backend, then fetches the full transcript with Vietnamese translations
- Polls the YouTube player every 200ms to sync the active subtitle line
- Keyboard shortcuts (`A`/`D` navigate lines, `R` replay, `S` toggle loop, arrow keys seek ±2s)

**`components/DictationMode.tsx`** — word-by-word typing practice UI, color-coded feedback, auto-advance on correct input, Tab to reveal, auto-replay on completion.

**`components/RubyText.tsx`** — renders Chinese text with pinyin annotations using the HTML `<ruby>` element, powered by `pinyin-pro`.

**`components/ui/`** — shadcn/ui components (Button, Input, Badge, Select, Card, Separator). These are vendored — edit directly rather than regenerating.

### Backend (`server/index.ts`)

Elysia server with two meaningful endpoints:
- `GET /languages/:videoId` — calls `youtube-transcript` to list available caption tracks
- `GET /transcript/:videoId?lang=xx&translate_to=vi` — fetches transcript, batch-translates to target language via `@vitalets/google-translate-api`, returns both original and translated lines

Translated transcripts are cached in-memory (Map keyed by `videoId:lang:translateTo`) to avoid re-hitting the translation API.

### Data shapes

The transcript is an array of `{ text, start, duration }` objects from the YouTube transcript library. The frontend pairs each with a translation string at the same index. The `TranscriptLine` type in App.tsx merges these as `{ text, translation, start, duration }`.

## Key conventions

- **Tailwind v4** with CSS variables — color tokens are defined in [src/index.css](src/index.css) using OKLch. Extend theme via CSS variables, not `tailwind.config`.
- Path alias `@/` maps to `src/` in both Vite and TypeScript configs.
- The backend uses Bun-specific APIs; don't introduce Node.js-only modules in `server/`.
- `zustand` is installed but not yet wired up — App.tsx uses local React state.
