import type { AppState } from '@/types/pdf';
import type { AppAction } from '../actions';
import { autoAssignEvidenceNumbers } from './reducer-helpers';

export function stampReducer(state: AppState, action: AppAction): AppState | null {
  switch (action.type) {
    case 'STAMP_ENABLED_TOGGLED': {
      const newStampEnabled = !state.stampEnabled;
      if (!newStampEnabled) return { ...state, stampEnabled: false };
      return autoAssignEvidenceNumbers({ ...state, stampEnabled: true });
    }
    case 'STAMP_SETTINGS_UPDATED': {
      const newSettings = { ...state.stampSettings, ...action.payload.settings };
      localStorage.setItem('waketena_stamp_settings', JSON.stringify(newSettings));
      return { ...state, stampSettings: newSettings };
    }
    case 'EXPORT_MODE_SET':
      return { ...state, exportMode: action.payload.mode };
    default:
      return null;
  }
}
