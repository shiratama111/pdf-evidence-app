import type { AppState } from '@/types/pdf';
import type { AppAction } from '../actions';
import { getSegmentColor } from '@/constants/defaults';

export function processingReducer(state: AppState, action: AppAction): AppState | null {
  switch (action.type) {
    case 'LOADING_STARTED':
      return { ...state, isLoading: true, loadingMessage: action.payload.message };
    case 'LOADING_FINISHED':
      return { ...state, isLoading: false, loadingMessage: '' };
    case 'EXPORT_STARTED':
      return { ...state, isExporting: true, exportProgress: 0 };
    case 'EXPORT_PROGRESS':
      return { ...state, exportProgress: action.payload.progress };
    case 'EXPORT_FINISHED':
      return { ...state, isExporting: false, exportProgress: 100 };
    case 'PRINT_STARTED':
      return { ...state, isPrinting: true };
    case 'PRINT_FINISHED':
      return { ...state, isPrinting: false };
    case 'GEMINI_API_KEY_SET':
      localStorage.setItem('waketena_gemini_key', action.payload.key);
      return { ...state, geminiApiKey: action.payload.key };
    case 'AI_PROCESSING_STARTED':
      return { ...state, isAiProcessing: true, aiSuggestions: null };
    case 'AI_SUGGESTIONS_RECEIVED':
      return { ...state, aiSuggestions: action.payload.suggestions, isAiProcessing: false };
    case 'AI_SUGGESTIONS_APPLIED': {
      if (!state.aiSuggestions) return state;
      const allPageIds = state.segments.flatMap(segment => segment.pageIds);
      const newSegments = state.aiSuggestions.segments.map((suggestion, index) => ({
        id: crypto.randomUUID(),
        name: suggestion.suggestedName,
        pageIds: allPageIds.slice(suggestion.pageRange[0], suggestion.pageRange[1] + 1),
        color: getSegmentColor(index),
        isCollapsed: false,
        evidenceNumber: null,
        groupId: null,
      }));
      return { ...state, segments: newSegments, aiSuggestions: null };
    }
    case 'AI_SUGGESTIONS_DISMISSED':
      return { ...state, aiSuggestions: null };
    case 'AI_PROCESSING_FINISHED':
      return { ...state, isAiProcessing: false };
    default:
      return null;
  }
}
