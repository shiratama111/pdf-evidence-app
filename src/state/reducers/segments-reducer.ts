import type { AppState } from '@/types/pdf';
import type { AppAction } from '../actions';
import { autoAssignEvidenceNumbers } from './reducer-helpers';
import {
  bulkReorderSegments,
  createEvidenceGroup,
  deleteSegment,
  groupSelectedSegments,
  mergeAllSegments,
  mergeSegmentWithNext,
  movePages,
  reorderGroupChildren,
  reorderSegments,
  splitSegmentAt,
} from './segments-helpers';

export function segmentsReducer(state: AppState, action: AppAction): AppState | null {
  switch (action.type) {
    case 'SEGMENT_SPLIT_AT':
      return splitSegmentAt(state, action.payload.segmentId, action.payload.afterPageId);
    case 'SEGMENT_RENAMED':
      return {
        ...state,
        segments: state.segments.map(segment =>
          segment.id === action.payload.segmentId ? { ...segment, name: action.payload.name } : segment
        ),
      };
    case 'SEGMENT_DELETED':
      return deleteSegment(state, action.payload.segmentId);
    case 'SEGMENTS_MERGE_ALL':
      return mergeAllSegments(state);
    case 'SEGMENTS_MERGE':
      return mergeSegmentWithNext(state, action.payload.segmentId);
    case 'SEGMENTS_BULK_REORDERED':
      return bulkReorderSegments(state, action.payload.segmentIds);
    case 'PAGES_MOVED':
      return movePages(
        state,
        action.payload.pageIds,
        action.payload.targetSegmentId,
        action.payload.targetIndex,
      );
    case 'SEGMENT_REORDERED':
      return reorderSegments(state, action.payload.fromIndex, action.payload.toIndex);
    case 'EVIDENCE_NUMBER_SET':
      return {
        ...state,
        segments: state.segments.map(segment =>
          segment.id === action.payload.segmentId
            ? { ...segment, evidenceNumber: action.payload.evidenceNumber }
            : segment
        ),
      };
    case 'EVIDENCE_NUMBERS_AUTO_ASSIGN':
      return autoAssignEvidenceNumbers(state);
    case 'EVIDENCE_GROUP_CREATED':
      return createEvidenceGroup(state, action.payload.segmentId, action.payload.afterPageId);
    case 'EVIDENCE_GROUP_DISSOLVED': {
      const seg = state.segments.find(segment => segment.id === action.payload.segmentId);
      if (!seg || !seg.evidenceNumber) return state;
      return {
        ...state,
        segments: state.segments.map(segment =>
          segment.id === action.payload.segmentId
            ? { ...segment, evidenceNumber: { main: seg.evidenceNumber!.main, sub: null } }
            : segment
        ),
      };
    }
    case 'SEGMENTS_GROUPED':
      return groupSelectedSegments(state);
    case 'SEGMENTS_UNGROUPED':
      return {
        ...state,
        segments: state.segments.map(segment =>
          segment.groupId === action.payload.groupId
            ? {
              ...segment,
              groupId: null,
              evidenceNumber: segment.evidenceNumber
                ? { main: segment.evidenceNumber.main, sub: null }
                : null,
              mergeInExport: undefined,
              groupName: undefined,
            }
            : segment
        ),
      };
    case 'GROUP_MERGE_TOGGLED':
      return {
        ...state,
        segments: state.segments.map(segment =>
          segment.groupId === action.payload.groupId
            ? { ...segment, mergeInExport: action.payload.mergeInExport }
            : segment
        ),
      };
    case 'GROUP_RENAMED': {
      const trimmed = action.payload.name.trim();
      return {
        ...state,
        segments: state.segments.map(segment =>
          segment.groupId === action.payload.groupId
            ? { ...segment, groupName: trimmed.length > 0 ? trimmed : undefined }
            : segment
        ),
      };
    }
    case 'GROUP_CHILD_REORDERED':
      return reorderGroupChildren(
        state,
        action.payload.groupId,
        action.payload.fromSegmentId,
        action.payload.toSegmentId,
      );
    default:
      return null;
  }
}
