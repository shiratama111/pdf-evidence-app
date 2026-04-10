import type { AppState } from '@/types/pdf';
import type { AppAction } from '../actions';
import { recolorSegments } from './reducer-helpers';

export function pagesReducer(state: AppState, action: AppAction): AppState | null {
  switch (action.type) {
    case 'PAGES_ROTATED': {
      const newPages = { ...state.pages };
      for (const pageId of action.payload.pageIds) {
        const page = newPages[pageId];
        if (page) {
          const newRotation = (page.rotation + action.payload.degrees + 360) % 360;
          newPages[pageId] = { ...page, rotation: newRotation, thumbnailUrl: null };
        }
      }
      return { ...state, pages: newPages };
    }
    case 'PAGES_DELETED': {
      const deletedSet = new Set(action.payload.pageIds);
      const newSegments = state.segments
        .map(segment => ({ ...segment, pageIds: segment.pageIds.filter(pageId => !deletedSet.has(pageId)) }))
        .filter(segment => segment.pageIds.length > 0);
      const newPages = { ...state.pages };
      for (const pageId of action.payload.pageIds) delete newPages[pageId];
      return {
        ...state,
        pages: newPages,
        segments: recolorSegments(newSegments),
        selectedPageIds: state.selectedPageIds.filter(pageId => !deletedSet.has(pageId)),
        previewPageId: deletedSet.has(state.previewPageId ?? '') ? null : state.previewPageId,
      };
    }
    case 'PAGE_THUMBNAIL_READY': {
      const page = state.pages[action.payload.pageId];
      if (!page) return state;
      return {
        ...state,
        pages: {
          ...state.pages,
          [action.payload.pageId]: { ...page, thumbnailUrl: action.payload.thumbnailUrl },
        },
      };
    }
    case 'REDACTION_ADDED': {
      const page = state.pages[action.payload.pageId];
      if (!page) return state;
      return {
        ...state,
        pages: {
          ...state.pages,
          [action.payload.pageId]: {
            ...page,
            redactions: [...page.redactions, action.payload.redaction],
          },
        },
      };
    }
    case 'REDACTION_REMOVED': {
      const page = state.pages[action.payload.pageId];
      if (!page) return state;
      return {
        ...state,
        pages: {
          ...state.pages,
          [action.payload.pageId]: {
            ...page,
            redactions: page.redactions.filter(redaction => redaction.id !== action.payload.redactionId),
          },
        },
      };
    }
    default:
      return null;
  }
}
