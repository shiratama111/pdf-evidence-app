import type { AppState } from '@/types/pdf';
import type { AppAction } from '../actions';

export function uiReducer(state: AppState, action: AppAction): AppState | null {
  switch (action.type) {
    case 'PAGE_SELECTED': {
      const { pageId, additive } = action.payload;
      if (additive) {
        const exists = state.selectedPageIds.includes(pageId);
        return {
          ...state,
          selectedPageIds: exists
            ? state.selectedPageIds.filter(selectedPageId => selectedPageId !== pageId)
            : [...state.selectedPageIds, pageId],
        };
      }
      return { ...state, selectedPageIds: [pageId] };
    }
    case 'PAGE_SELECTION_SET': {
      const seen = new Set<string>();
      const pageIds = action.payload.pageIds.filter(pageId => {
        if (!state.pages[pageId] || seen.has(pageId)) return false;
        seen.add(pageId);
        return true;
      });
      return { ...state, selectedPageIds: pageIds };
    }
    case 'SELECTION_CLEARED':
      return { ...state, selectedPageIds: [] };
    case 'PREVIEW_SET':
      return {
        ...state,
        previewPageId: action.payload.pageId,
        isPreviewOpen: action.payload.pageId !== null,
      };
    case 'PREVIEW_TOGGLED':
      return { ...state, isPreviewOpen: !state.isPreviewOpen };
    case 'SEGMENT_SELECTED': {
      const { segmentId, additive } = action.payload;
      if (additive) {
        const exists = state.selectedSegmentIds.includes(segmentId);
        return {
          ...state,
          selectedSegmentIds: exists
            ? state.selectedSegmentIds.filter(selectedSegmentId => selectedSegmentId !== segmentId)
            : [...state.selectedSegmentIds, segmentId],
        };
      }
      return { ...state, selectedSegmentIds: [segmentId] };
    }
    case 'SEGMENT_SELECTION_CLEARED':
      return { ...state, selectedSegmentIds: [] };
    case 'SEGMENT_FOCUSED':
      return {
        ...state,
        focusedSegmentId: action.payload.segmentId,
        focusedGroupId: null,
        focusVersion: action.payload.withScroll === false ? state.focusVersion : state.focusVersion + 1,
      };
    case 'GROUP_FOCUSED':
      return {
        ...state,
        focusedGroupId: action.payload.groupId,
        focusedSegmentId: null,
        focusVersion: action.payload.withScroll === false ? state.focusVersion : state.focusVersion + 1,
      };
    case 'REDACTION_MODE_TOGGLED':
      return { ...state, redactionMode: !state.redactionMode };
    default:
      return null;
  }
}
