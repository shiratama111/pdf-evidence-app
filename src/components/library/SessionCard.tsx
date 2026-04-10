import { useState, useEffect, useRef } from 'react';
import { Pin, PinOff, Trash2, FileText } from 'lucide-react';
import type { LibraryEntry } from '@/types/session';
import { getLibraryThumbnailDataUrl } from '@/lib/library-client';

interface Props {
  session: LibraryEntry;
  isCurrent: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onPin: (id: string, pinned: boolean) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

export function SessionCard({ session, isCurrent, onOpen, onDelete, onRename, onPin }: Props) {
  const [thumbDataUrl, setThumbDataUrl] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(session.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    getLibraryThumbnailDataUrl(session.id).then(url => {
      if (!cancelled) setThumbDataUrl(url);
    });
    return () => { cancelled = true; };
  }, [session.id]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleNameSubmit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== session.name) {
      onRename(session.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`「${session.name}」を削除しますか？`)) {
      onDelete(session.id);
    }
  };

  const handlePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPin(session.id, !session.pinned);
  };

  return (
    <div
      className={`border rounded-lg overflow-hidden bg-white hover:shadow-lg transition-shadow cursor-pointer relative group ${
        isCurrent ? 'ring-2 ring-blue-500' : 'border-gray-200'
      }`}
      onClick={() => !isEditing && onOpen(session.id)}
    >
      {/* サムネイル */}
      <div className="aspect-[3/4] bg-gray-100 flex items-center justify-center overflow-hidden">
        {thumbDataUrl ? (
          <img src={thumbDataUrl} alt={session.name} className="w-full h-full object-contain" />
        ) : (
          <FileText className="w-12 h-12 text-gray-300" />
        )}
      </div>

      {/* 情報 */}
      <div className="p-2 space-y-1">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameSubmit();
              if (e.key === 'Escape') { setEditValue(session.name); setIsEditing(false); }
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full px-1 py-0.5 text-sm border border-blue-400 rounded"
          />
        ) : (
          <div
            className="text-sm font-medium text-gray-800 truncate"
            title="ダブルクリックで編集"
            onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
          >
            {session.name}
          </div>
        )}
        <div className="text-xs text-gray-500 truncate">
          {formatDateTime(session.updatedAt)}
        </div>
        <div className="text-xs text-gray-400 truncate">
          {session.pageCount}ページ・{session.segmentCount}件・{formatBytes(session.fileSizeBytes)}
        </div>
      </div>

      {/* 現在編集中バッジ */}
      {isCurrent && (
        <div className="absolute top-2 left-2 px-2 py-0.5 text-xs bg-blue-500 text-white rounded shadow">
          編集中
        </div>
      )}

      {/* オーバーレイ操作 */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handlePin}
          className={`p-1.5 rounded-full shadow ${session.pinned ? 'bg-amber-400 text-white' : 'bg-white/90 text-gray-600 hover:bg-amber-100'}`}
          title={session.pinned ? 'ピン留め解除' : 'ピン留め（30件カウント外）'}
        >
          {session.pinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
        </button>
        <button
          onClick={handleDelete}
          className="p-1.5 rounded-full bg-white/90 text-gray-600 hover:bg-red-100 hover:text-red-600 shadow"
          title="削除"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* ピン留め常時表示 */}
      {session.pinned && (
        <div className="absolute top-2 right-2 group-hover:opacity-0 transition-opacity">
          <div className="p-1.5 rounded-full bg-amber-400 text-white shadow">
            <Pin className="w-4 h-4" />
          </div>
        </div>
      )}
    </div>
  );
}
