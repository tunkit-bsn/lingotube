import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, Folder, FolderOpen, BookOpen, Plus, Trash2 } from 'lucide-react'

const API = 'http://localhost:3000'

interface SavedSubtitle {
  id: number
  folder_id: number | null
  video_id: string
  video_title: string
  text: string
  translated: string
  lang: string
  offset: number
  duration: number
}

interface FlatFolder {
  id: number
  parent_id: number | null
  name: string
}

interface FolderNode extends FlatFolder {
  children: FolderNode[]
  subtitles: SavedSubtitle[]
}

function buildTree(folders: FlatFolder[], subtitles: SavedSubtitle[]): { roots: FolderNode[]; unorganized: SavedSubtitle[] } {
  const map = new Map<number, FolderNode>()
  for (const f of folders) map.set(f.id, { ...f, children: [], subtitles: [] })
  for (const s of subtitles) {
    if (s.folder_id !== null && map.has(s.folder_id)) {
      map.get(s.folder_id)!.subtitles.push(s)
    }
  }
  const roots: FolderNode[] = []
  for (const node of map.values()) {
    if (node.parent_id === null) roots.push(node)
    else map.get(node.parent_id)?.children.push(node)
  }
  const unorganized = subtitles.filter(s => s.folder_id === null)
  return { roots, unorganized }
}

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

interface FolderNodeProps {
  node: FolderNode
  depth: number
  openFolders: Set<number>
  selected: SavedSubtitle | null
  onToggle: (id: number) => void
  onSelect: (sub: SavedSubtitle) => void
  onDelete: (id: number) => void
  onDeleteSub: (id: number) => void
  onAddSubfolder: (parentId: number) => void
  onRename: (id: number, name: string) => void
  onMoveSubtitle: (subtitleId: number, folderId: number | null) => void
}

function FolderNodeView({ node, depth, openFolders, selected, onToggle, onSelect, onDelete, onDeleteSub, onAddSubfolder, onRename, onMoveSubtitle }: FolderNodeProps) {
  const isOpen = openFolders.has(node.id)
  const indent = depth * 12
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(node.name)
  const [dragOver, setDragOver] = useState(false)

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation()
    setEditName(node.name)
    setEditing(true)
  }

  function commitEdit() {
    if (editName.trim() && editName.trim() !== node.name) {
      onRename(node.id, editName.trim())
    }
    setEditing(false)
  }

  return (
    <div>
      <div
        className={`group flex items-center transition-colors ${dragOver ? 'bg-primary/10' : ''}`}
        style={{ paddingLeft: indent }}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault()
          setDragOver(false)
          const id = Number(e.dataTransfer.getData('subtitleId'))
          if (id) onMoveSubtitle(id, node.id)
        }}
      >
        <button
          onClick={() => !editing && onToggle(node.id)}
          className="flex-1 flex items-center gap-1.5 px-3 py-2 hover:bg-muted/50 transition-colors text-left min-w-0"
        >
          {isOpen
            ? <ChevronDown size={13} className="text-muted-foreground shrink-0" />
            : <ChevronRight size={13} className="text-muted-foreground shrink-0" />
          }
          {isOpen
            ? <FolderOpen size={13} className="text-muted-foreground shrink-0" />
            : <Folder size={13} className="text-muted-foreground shrink-0" />
          }
          {editing ? (
            <input
              autoFocus
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => {
                if (e.key === 'Enter') commitEdit()
                if (e.key === 'Escape') setEditing(false)
                e.stopPropagation()
              }}
              onClick={e => e.stopPropagation()}
              className="flex-1 text-sm font-medium bg-transparent border-b border-border outline-none min-w-0"
            />
          ) : (
            <span className="text-sm font-medium truncate flex-1" onDoubleClick={startEdit}>{node.name}</span>
          )}
          {!editing && (
            <span className="text-xs text-muted-foreground shrink-0">
              {node.subtitles.length + node.children.reduce((a, c) => a + c.subtitles.length, 0)}
            </span>
          )}
        </button>
        <div className="pr-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => onAddSubfolder(node.id)} className="text-muted-foreground hover:text-foreground">
            <Plus size={13} />
          </button>
          <button onClick={() => onDelete(node.id)} className="text-muted-foreground hover:text-destructive">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {isOpen && (
        <>
          {node.children.map(child => (
            <FolderNodeView
              key={child.id}
              node={child}
              depth={depth + 1}
              openFolders={openFolders}
              selected={selected}
              onToggle={onToggle}
              onSelect={onSelect}
              onDelete={onDelete}
              onDeleteSub={onDeleteSub}
              onAddSubfolder={onAddSubfolder}
              onRename={onRename}
              onMoveSubtitle={onMoveSubtitle}
            />
          ))}
          {node.subtitles.map(sub => (
            <SubtitleRow
              key={sub.id}
              sub={sub}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
              onDelete={onDeleteSub}
            />
          ))}
        </>
      )}
    </div>
  )
}

interface SubtitleRowProps {
  sub: SavedSubtitle
  depth: number
  selected: SavedSubtitle | null
  onSelect: (sub: SavedSubtitle) => void
  onDelete: (id: number) => void
}

function SubtitleRow({ sub, depth, selected, onSelect, onDelete }: SubtitleRowProps) {
  const indent = depth * 12 + 12
  return (
    <div
      className="group relative"
      style={{ paddingLeft: indent }}
      draggable
      onDragStart={e => { e.dataTransfer.setData('subtitleId', String(sub.id)); e.dataTransfer.effectAllowed = 'move' }}
    >
      <button
        onClick={() => onSelect(sub)}
        className={`w-full flex flex-col gap-0.5 px-3 py-2 text-left border-l-2 transition-colors hover:bg-muted/50
          ${selected?.id === sub.id ? 'border-l-primary bg-primary/5' : 'border-l-transparent'}`}
      >
        <span className="text-sm leading-snug line-clamp-2 pr-5">{sub.text}</span>
        <span className="text-xs text-muted-foreground line-clamp-1">{sub.translated}</span>
        <span className="text-xs text-muted-foreground/60 mt-0.5">{sub.video_title} · {formatTime(sub.offset)}</span>
      </button>
      <button
        onClick={() => onDelete(sub.id)}
        className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}

interface NewFolderInputProps {
  onConfirm: (name: string) => void
  onCancel: () => void
}

function NewFolderInput({ onConfirm, onCancel }: NewFolderInputProps) {
  const [name, setName] = useState('')
  return (
    <div className="px-3 py-2 border-b flex gap-2">
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onConfirm(name); if (e.key === 'Escape') onCancel() }}
        placeholder="Tên thư mục..."
        className="flex-1 text-sm bg-transparent border-b border-border outline-none py-0.5"
      />
      <Button size="sm" className="h-7 text-xs px-2" onClick={() => onConfirm(name)}>Tạo</Button>
    </div>
  )
}

export function SavedPage() {
  const [roots, setRoots] = useState<FolderNode[]>([])
  const [unorganized, setUnorganized] = useState<SavedSubtitle[]>([])
  const [openFolders, setOpenFolders] = useState<Set<number>>(new Set())
  const [selected, setSelected] = useState<SavedSubtitle | null>(null)
  const [newFolderParent, setNewFolderParent] = useState<number | null | 'root'>('root')
  const [showNewFolder, setShowNewFolder] = useState(false)

  async function loadData() {
    const res = await fetch(`${API}/folders`)
    const json = await res.json() as { folders: FlatFolder[]; subtitles: SavedSubtitle[] }
    const { roots, unorganized } = buildTree(json.folders, json.subtitles)
    setRoots(roots)
    setUnorganized(unorganized)
    setOpenFolders(prev => {
      const next = new Set(prev)
      json.folders.forEach(f => next.add(f.id))
      return next
    })
  }

  useEffect(() => { loadData() }, [])

  function toggleFolder(id: number) {
    setOpenFolders(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function createFolder(name: string) {
    if (!name.trim()) return
    const parentId = newFolderParent === 'root' ? undefined : newFolderParent ?? undefined
    await fetch(`${API}/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), parentId }),
    })
    setShowNewFolder(false)
    loadData()
  }

  async function moveSubtitle(subtitleId: number, folderId: number | null) {
    await fetch(`${API}/saved/${subtitleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId }),
    })
    loadData()
  }

  async function renameFolder(id: number, name: string) {
    await fetch(`${API}/folders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    loadData()
  }

  async function deleteFolder(id: number) {
    await fetch(`${API}/folders/${id}`, { method: 'DELETE' })
    loadData()
  }

  async function deleteSubtitle(id: number) {
    await fetch(`${API}/saved/${id}`, { method: 'DELETE' })
    if (selected?.id === id) setSelected(null)
    loadData()
  }

  function openAddSubfolder(parentId: number) {
    setNewFolderParent(parentId)
    setShowNewFolder(true)
  }

  function openAddRoot() {
    setNewFolderParent('root')
    setShowNewFolder(true)
  }

  const playerSrc = selected
    ? `https://www.youtube.com/embed/${selected.video_id}?start=${Math.floor(selected.offset / 1000)}&autoplay=1`
    : null

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/" className="text-xl font-bold hover:opacity-80 transition-opacity">LinguaTube</Link>
          <Badge variant="secondary">Beta</Badge>
        </div>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Quay lại
        </Link>
      </header>

      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 65px)' }}>
        {/* Sidebar */}
        <aside className="w-72 border-r flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen size={15} className="text-muted-foreground" />
              <span className="text-sm font-medium">Phụ đề đã lưu</span>
            </div>
            <button
              onClick={openAddRoot}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Tạo thư mục gốc"
            >
              <Plus size={15} />
            </button>
          </div>

          {showNewFolder && (
            <NewFolderInput
              onConfirm={createFolder}
              onCancel={() => setShowNewFolder(false)}
            />
          )}

          <div className="flex-1 overflow-y-auto py-2">
            {roots.length === 0 && unorganized.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">Chưa có phụ đề nào</p>
            ) : (
              <>
                {roots.map(node => (
                  <FolderNodeView
                    key={node.id}
                    node={node}
                    depth={0}
                    openFolders={openFolders}
                    selected={selected}
                    onToggle={toggleFolder}
                    onSelect={setSelected}
                    onDelete={deleteFolder}
                    onDeleteSub={deleteSubtitle}
                    onAddSubfolder={openAddSubfolder}
                    onRename={renameFolder}
                    onMoveSubtitle={moveSubtitle}
                  />
                ))}

                {/* Unorganized */}
                {unorganized.length > 0 && (
                  <div
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault()
                      const id = Number(e.dataTransfer.getData('subtitleId'))
                      if (id) moveSubtitle(id, null)
                    }}
                  >
                    <button
                      onClick={() => toggleFolder(-1)}
                      className="w-full flex items-center gap-1.5 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
                    >
                      {openFolders.has(-1)
                        ? <ChevronDown size={13} className="text-muted-foreground" />
                        : <ChevronRight size={13} className="text-muted-foreground" />
                      }
                      <Folder size={13} className="text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground flex-1">Chưa phân loại</span>
                      <span className="text-xs text-muted-foreground">{unorganized.length}</span>
                    </button>
                    {openFolders.has(-1) && unorganized.map(sub => (
                      <SubtitleRow
                        key={sub.id}
                        sub={sub}
                        depth={1}
                        selected={selected}
                        onSelect={setSelected}
                        onDelete={deleteSubtitle}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col items-center justify-center p-8 gap-6 overflow-y-auto">
          {selected ? (
            <>
              <div className="w-full max-w-3xl aspect-video rounded-lg overflow-hidden border bg-muted">
                <iframe
                  key={playerSrc}
                  src={playerSrc!}
                  className="w-full h-full"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              </div>
              <div className="w-full max-w-3xl flex flex-col gap-1">
                <p className="text-lg font-medium">{selected.text}</p>
                <p className="text-sm text-muted-foreground">{selected.translated}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{selected.video_title} · {formatTime(selected.offset)}</p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-center">
              <BookOpen size={32} className="text-muted-foreground/40" />
              <p className="text-muted-foreground">Chọn một phụ đề để xem</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
