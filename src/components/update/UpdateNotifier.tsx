import { CheckCircle2, Download, RefreshCw, X } from 'lucide-react';
import { useAutoUpdater } from '@/hooks/useAutoUpdater';

export function UpdateNotifier() {
  const { state, installNow, dismiss } = useAutoUpdater();

  if (state.kind === 'idle' || state.kind === 'not-available') {
    return null;
  }

  if (state.kind === 'downloaded') {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-white border-2 border-green-300 rounded-xl shadow-2xl p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-800 text-sm">
              新しいバージョンの準備ができました
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {state.info.version ? `v${state.info.version}` : '新バージョン'}
              ・再起動で適用されます
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => {
                  void installNow();
                }}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg"
              >
                今すぐ再起動
              </button>
              <button
                onClick={dismiss}
                className="px-3 py-1.5 hover:bg-gray-100 text-gray-600 text-sm rounded-lg"
              >
                後で
              </button>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="text-gray-400 hover:text-gray-600"
            aria-label="閉じる"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs text-gray-600 flex items-center gap-2 max-w-xs">
      {state.kind === 'checking' && (
        <>
          <RefreshCw className="w-3 h-3 animate-spin text-blue-600 shrink-0" />
          <span>更新を確認中…</span>
        </>
      )}
      {state.kind === 'available' && (
        <>
          <Download className="w-3 h-3 text-blue-600 shrink-0" />
          <span>
            新バージョン
            {state.info.version ? ` v${state.info.version}` : ''} を検出 …
          </span>
        </>
      )}
      {state.kind === 'downloading' && (
        <>
          <Download className="w-3 h-3 text-blue-600 shrink-0" />
          <span className="shrink-0">ダウンロード中</span>
          <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${Math.max(0, Math.min(100, state.progress.percent))}%` }}
            />
          </div>
          <span className="shrink-0 tabular-nums">
            {Math.round(state.progress.percent)}%
          </span>
        </>
      )}
      {state.kind === 'error' && (
        <>
          <span className="text-red-600 truncate" title={state.error.message}>
            更新エラー: {state.error.message}
          </span>
          <button
            onClick={dismiss}
            className="text-gray-400 hover:text-gray-600 shrink-0"
            aria-label="閉じる"
          >
            <X className="w-3 h-3" />
          </button>
        </>
      )}
    </div>
  );
}
