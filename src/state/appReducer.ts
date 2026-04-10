import type { AppState } from '@/types/pdf';
import type { AppAction } from './actions';
import { DEFAULT_STAMP_SETTINGS } from '@/constants/defaults';
import { pagesReducer } from './reducers/pages-reducer';
import { processingReducer } from './reducers/processing-reducer';
import { segmentsReducer } from './reducers/segments-reducer';
import { sessionReducer } from './reducers/session-reducer';
import { stampReducer } from './reducers/stamp-reducer';
import { uiReducer } from './reducers/ui-reducer';

function loadStampSettings() {
  try {
    const saved = localStorage.getItem('waketena_stamp_settings');
    if (saved) return { ...DEFAULT_STAMP_SETTINGS, ...JSON.parse(saved) };
  } catch { /* ignore */ }
  return DEFAULT_STAMP_SETTINGS;
}

export const initialState: AppState = {
  sourceFiles: {},
  pages: {},
  segments: [],
  selectedPageIds: [],
  previewPageId: null,
  isPreviewOpen: false,
  isLoading: false,
  loadingMessage: '',
  isExporting: false,
  exportProgress: 0,
  geminiApiKey: localStorage.getItem('waketena_gemini_key'),
  aiSuggestions: null,
  isAiProcessing: false,
  stampEnabled: false,
  stampSettings: loadStampSettings(),
  exportMode: 'split_pdfs',
  selectedSegmentIds: [],
  focusedSegmentId: null,
  focusedGroupId: null,
  focusVersion: 0,
  redactionMode: false,
  currentSessionId: null,
  lastSavedAt: null,
  saveStatus: 'idle',
};

export function appReducer(state: AppState, action: AppAction): AppState {
  return (
    sessionReducer(state, action) ??
    segmentsReducer(state, action) ??
    pagesReducer(state, action) ??
    uiReducer(state, action) ??
    processingReducer(state, action) ??
    stampReducer(state, action) ??
    state
  );
}
