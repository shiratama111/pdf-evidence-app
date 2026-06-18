import { useAppState } from '@/state/AppContext';
import { Header } from '@/components/layout/Header';
import { SegmentList } from '@/components/sidebar/SegmentList';
import { ThumbnailGrid } from '@/components/workspace/ThumbnailGrid';
import { PreviewPanel } from '@/components/preview/PreviewPanel';
import { UploadArea } from '@/components/upload/UploadArea';
import { AiSuggestions } from '@/components/ai/AiSuggestions';
import { StampSettingsPanel } from '@/components/stamp/StampSettingsPanel';
import { UpdateNotifier } from '@/components/update/UpdateNotifier';
import { Loader2 } from 'lucide-react';

export default function App() {
  const {
    segments,
    isLoading,
    loadingMessage,
    isExporting,
    isPrinting,
    exportMessage,
    exportProgress,
    isPreviewOpen,
    stampEnabled,
  } = useAppState();
  const hasFiles = segments.length > 0;
  const showBlockingProgress = isLoading || isExporting || isPrinting;
  const progressMessage = isLoading ? loadingMessage : exportMessage;

  return (
    <div className="flex flex-col h-screen">
      <Header />

      <div className="flex flex-1 min-h-0">
        {hasFiles ? (
          <>
            {/* Left sidebar */}
            <SegmentList />

            {/* Center workspace */}
            <ThumbnailGrid />

            {/* Stamp settings panel */}
            {stampEnabled && <StampSettingsPanel />}

            {/* Right preview */}
            {isPreviewOpen && <PreviewPanel />}
          </>
        ) : (
          <div className="flex-1 p-8">
            <UploadArea />
          </div>
        )}
      </div>

      {/* AI suggestions */}
      <AiSuggestions />

      {/* Auto-update notifier (bottom-right toast) */}
      <UpdateNotifier />

      {/* Loading overlay */}
      {showBlockingProgress && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-2xl min-w-[280px]">
            <div className="flex items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-gray-700">{progressMessage}</span>
            </div>
            {(isExporting || isPrinting) && (
              <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, exportProgress))}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
