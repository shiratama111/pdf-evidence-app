import { useAppState, useAppDispatch } from '@/state/AppContext';
import { Check, X, Sparkles } from 'lucide-react';

export function AiSuggestions() {
  const { aiSuggestions } = useAppState();
  const dispatch = useAppDispatch();

  if (!aiSuggestions) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-white border border-purple-200 rounded-xl shadow-2xl p-4 max-w-lg w-full">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-purple-600" />
        <h3 className="text-sm font-semibold text-gray-800">AI分割提案</h3>
      </div>

      <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
        {aiSuggestions.segments.map((seg, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-2 bg-purple-50 rounded-lg"
          >
            <span className="text-xs text-gray-500 w-6">#{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-700 truncate">
                {seg.suggestedName}
              </div>
              <div className="text-xs text-gray-500">
                {seg.documentType} ・ p{seg.pageRange[0] + 1}〜{seg.pageRange[1] + 1}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => dispatch({ type: 'AI_SUGGESTIONS_DISMISSED' })}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"
        >
          <X className="w-4 h-4" />
          却下
        </button>
        <button
          onClick={() => dispatch({ type: 'AI_SUGGESTIONS_APPLIED' })}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium"
        >
          <Check className="w-4 h-4" />
          適用
        </button>
      </div>
    </div>
  );
}
