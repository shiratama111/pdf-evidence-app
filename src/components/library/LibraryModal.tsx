import { useEffect } from 'react';
import { X, Plus, Download, Upload, FolderOpen } from 'lucide-react';
import { useAppState } from '@/state/AppContext';
import { useLibrary } from '@/hooks/useLibrary';
import { SessionCard } from './SessionCard';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function LibraryModal({ isOpen, onClose }: Props) {
  const state = useAppState();
  const {
    sessions,
    isLoading,
    refresh,
    openSession,
    deleteSession,
    renameSession,
    pinSession,
    startNewSession,
    exportArchive,
    importArchive,
  } = useLibrary();

  useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen, refresh]);

  // ESCで閉じる
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const unpinnedCount = sessions.filter(s => !s.pinned).length;

  const handleOpen = async (id: string) => {
    await openSession(id);
    onClose();
  };

  const handleNew = () => {
    startNewSession();
    onClose();
  };

  const handleImport = async () => {
    await importArchive();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-800">ライブラリ</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
            title="閉じる (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-gray-50">
          <button
            onClick={handleNew}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
            title="新規セッションを開始"
          >
            <Plus className="w-4 h-4" />
            新規セッション
          </button>
          <button
            onClick={exportArchive}
            disabled={state.segments.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            title="現在のセッションをアーカイブ書き出し（.pdfevd）"
          >
            <Download className="w-4 h-4" />
            アーカイブ書き出し
          </button>
          <button
            onClick={handleImport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
            title="アーカイブを読み込む（.pdfevd）"
          >
            <Upload className="w-4 h-4" />
            アーカイブ読み込み
          </button>
          <div className="flex-1" />
          <span className={`text-xs ${unpinnedCount >= 25 ? 'text-amber-600' : 'text-gray-500'}`}>
            {unpinnedCount} / 30 件 {sessions.filter(s => s.pinned).length > 0 && `(ピン留め ${sessions.filter(s => s.pinned).length})`}
          </span>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center text-gray-500 py-8">読み込み中...</div>
          ) : sessions.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <FolderOpen className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>ライブラリは空です</p>
              <p className="text-xs mt-1">編集を開始すると自動で保存されます</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  isCurrent={state.currentSessionId === session.id}
                  onOpen={handleOpen}
                  onDelete={deleteSession}
                  onRename={renameSession}
                  onPin={pinSession}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-200 text-xs text-gray-500 bg-gray-50">
          自動保存先: %APPDATA%/pdf-evidence-app/library/ ・ ピン留めしたセッションは自動削除の対象外になります
        </div>
      </div>
    </div>
  );
}
