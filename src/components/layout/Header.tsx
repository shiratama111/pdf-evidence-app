import { useRef, useState, useEffect } from 'react';
import { useAppState, useAppDispatch, useUndoRedo } from '@/state/AppContext';
import { usePdfLoader } from '@/hooks/usePdfLoader';
import { useExport } from '@/hooks/useExport';
import { useGemini } from '@/hooks/useGemini';
import {
  FilePlus, Download, RotateCcw, PanelRight,
  Sparkles, Loader2, Stamp, Undo2, Redo2,
  FolderOpen, Check, AlertTriangle,
} from 'lucide-react';
import { LibraryModal } from '@/components/library/LibraryModal';

export function Header() {
  const state = useAppState();
  const { canUndo, canRedo, undo, redo } = useUndoRedo();
  const dispatch = useAppDispatch();
  const { loadFiles } = usePdfLoader();
  const { exportIndividual, exportMerged, exportSelected, isExporting } = useExport();
  const { analyze, isProcessing: isAiProcessing } = useGemini();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  const hasFiles = state.segments.length > 0;

  return (
    <header className="h-12 flex items-center px-3 border-b border-gray-200 bg-white gap-2 flex-shrink-0">
      {/* Logo */}
      <h1 className="text-base font-bold text-gray-800 mr-4 select-none">
        <span className="text-blue-600">PDF証拠作成</span>
      </h1>

      {/* File add */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700"
      >
        <FilePlus className="w-4 h-4" />
        ファイル追加
      </button>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        multiple
        onChange={(e) => { if (e.target.files) loadFiles(e.target.files); e.target.value = ''; }}
      />

      {/* Library */}
      <button
        onClick={() => setIsLibraryOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700"
        title="ライブラリ・アーカイブ"
      >
        <FolderOpen className="w-4 h-4" />
        ライブラリ
      </button>

      {/* Reset */}
      {hasFiles && (
        <button
          onClick={() => dispatch({ type: 'STATE_RESET' })}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"
        >
          <RotateCcw className="w-4 h-4" />
          リセット
        </button>
      )}

      {/* Undo / Redo */}
      {hasFiles && (
        <div className="flex items-center gap-0.5">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 disabled:opacity-30"
            title="元に戻す (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 disabled:opacity-30"
            title="やり直し (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex-1" />

      {/* Save status indicator */}
      <SaveStatusIndicator status={state.saveStatus} lastSavedAt={state.lastSavedAt} />

      {/* Stamp toggle */}
      {hasFiles && (
        <button
          onClick={() => dispatch({ type: 'STAMP_ENABLED_TOGGLED' })}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            state.stampEnabled
              ? 'bg-amber-50 border-amber-300 text-amber-700'
              : 'border-gray-200 hover:bg-gray-50 text-gray-600'
          }`}
        >
          <Stamp className="w-4 h-4" />
          証拠番号
        </button>
      )}

      {/* AI button */}
      {hasFiles && (
        <button
          onClick={analyze}
          disabled={isAiProcessing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-purple-50 border border-purple-200 hover:bg-purple-100 text-purple-700 disabled:opacity-50"
        >
          {isAiProcessing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          AI分析
        </button>
      )}

      {/* Preview toggle */}
      <button
        onClick={() => dispatch({ type: 'PREVIEW_TOGGLED' })}
        className={`p-1.5 rounded-lg border ${
          state.isPreviewOpen ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-200 hover:bg-gray-50 text-gray-600'
        }`}
        title="プレビュー表示/非表示"
      >
        <PanelRight className="w-4 h-4" />
      </button>

      {/* Export */}
      {hasFiles && <ExportDropdown
        isExporting={isExporting}
        exportIndividual={exportIndividual}
        exportMerged={exportMerged}
        exportSelected={exportSelected}
        selectedCount={state.selectedSegmentIds.length}
      />}

      {/* Library Modal */}
      <LibraryModal isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} />
    </header>
  );
}

function SaveStatusIndicator({ status, lastSavedAt }: { status: 'idle' | 'saving' | 'saved' | 'failed'; lastSavedAt: string | null }) {
  if (status === 'idle') return null;

  if (status === 'saving') {
    return (
      <div className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500" title="自動保存中">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>保存中…</span>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="flex items-center gap-1 px-2 py-1 text-xs text-red-600" title="自動保存に失敗しました">
        <AlertTriangle className="w-3 h-3" />
        <span>保存失敗</span>
      </div>
    );
  }

  // saved
  let timeStr = '';
  if (lastSavedAt) {
    try {
      const d = new Date(lastSavedAt);
      const pad = (n: number) => String(n).padStart(2, '0');
      timeStr = ` ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch { /* ignore */ }
  }
  return (
    <div className="flex items-center gap-1 px-2 py-1 text-xs text-green-600" title="自動保存済み">
      <Check className="w-3 h-3" />
      <span>保存済{timeStr}</span>
    </div>
  );
}

function ExportDropdown({ isExporting, exportIndividual, exportMerged, exportSelected, selectedCount }: {
  isExporting: boolean;
  exportIndividual: () => void;
  exportMerged: () => void;
  exportSelected: () => void;
  selectedCount: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 外側クリックで閉じる
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleAction = (fn: () => void) => {
    setIsOpen(false);
    fn();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50"
      >
        {isExporting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        エクスポート
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[250px]">
          <button
            onClick={() => handleAction(exportIndividual)}
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
          >
            全てのファイルを個別にエクスポート
          </button>
          <button
            onClick={() => handleAction(exportMerged)}
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
          >
            ファイルを統合してエクスポート
          </button>
          <hr className="my-1 border-gray-100" />
          <button
            onClick={() => handleAction(exportSelected)}
            disabled={selectedCount === 0}
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            選択したファイルをエクスポート
            {selectedCount > 0 && (
              <span className="ml-1 text-xs text-blue-500">({selectedCount}件)</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
