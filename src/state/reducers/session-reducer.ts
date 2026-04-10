import type { AppState } from '@/types/pdf';
import type { AppAction } from '../actions';
import { initialState } from '../appReducer';
import { recolorSegments } from './reducer-helpers';

export function sessionReducer(state: AppState, action: AppAction): AppState | null {
  switch (action.type) {
    case 'FILES_LOADED': {
      const newSourceFiles = { ...state.sourceFiles };
      const newPages = { ...state.pages };
      for (const sourceFile of action.payload.sourceFiles) {
        newSourceFiles[sourceFile.id] = sourceFile;
      }
      for (const page of action.payload.pages) {
        newPages[page.id] = page;
      }
      return {
        ...state,
        sourceFiles: newSourceFiles,
        pages: newPages,
        segments: recolorSegments([...state.segments, ...action.payload.segments]),
        isLoading: false,
      };
    }
    case 'STATE_RESET':
      return {
        ...initialState,
        geminiApiKey: state.geminiApiKey,
        stampSettings: state.stampSettings,
      };
    case 'SESSION_ID_ASSIGNED':
      return { ...state, currentSessionId: action.payload.id };
    case 'SESSION_SAVE_STARTED':
      return { ...state, saveStatus: 'saving' };
    case 'SESSION_SAVE_FINISHED':
      return { ...state, saveStatus: 'saved', lastSavedAt: action.payload.savedAt };
    case 'SESSION_SAVE_FAILED':
      return { ...state, saveStatus: 'failed' };
    case 'SESSION_RESTORED':
      return {
        ...initialState,
        geminiApiKey: state.geminiApiKey,
        ...action.payload.state,
        currentSessionId: action.payload.sessionId,
        lastSavedAt: new Date().toISOString(),
        saveStatus: 'saved',
      };
    case 'SESSION_NEW_STARTED':
      return {
        ...initialState,
        geminiApiKey: state.geminiApiKey,
        stampSettings: state.stampSettings,
        currentSessionId: null,
        lastSavedAt: null,
        saveStatus: 'idle',
      };
    default:
      return null;
  }
}
