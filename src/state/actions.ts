import type { PageId, PdfPage, Segment, SourceFile, AiSplitSuggestion, StampSettings, ExportMode, EvidenceNumber, RedactionArea, AppState } from '@/types/pdf';

export type AppAction =
  // File operations
  | { type: 'FILES_LOADED'; payload: { sourceFiles: SourceFile[]; pages: PdfPage[]; segments: Segment[] } }

  // Page operations
  | { type: 'PAGES_ROTATED'; payload: { pageIds: PageId[]; degrees: 90 | -90 | 180 } }
  | { type: 'PAGES_DELETED'; payload: { pageIds: PageId[] } }
  | { type: 'PAGE_THUMBNAIL_READY'; payload: { pageId: PageId; thumbnailUrl: string } }

  // Segment operations
  | { type: 'SEGMENT_SPLIT_AT'; payload: { segmentId: string; afterPageId: PageId } }
  | { type: 'SEGMENT_RENAMED'; payload: { segmentId: string; name: string } }
  | { type: 'SEGMENT_DELETED'; payload: { segmentId: string } }
  | { type: 'SEGMENTS_MERGE_ALL' }
  | { type: 'SEGMENTS_MERGE'; payload: { segmentId: string; withNextSegment: true } }
  | { type: 'SEGMENTS_BULK_REORDERED'; payload: { segmentIds: string[] } }

  // D&D
  | { type: 'PAGES_MOVED'; payload: { pageIds: PageId[]; targetSegmentId: string; targetIndex: number } }
  | { type: 'SEGMENT_REORDERED'; payload: { fromIndex: number; toIndex: number } }

  // UI
  | { type: 'PAGE_SELECTED'; payload: { pageId: PageId; additive: boolean } }
  | { type: 'PAGE_SELECTION_SET'; payload: { pageIds: PageId[] } }
  | { type: 'SELECTION_CLEARED' }
  | { type: 'PREVIEW_SET'; payload: { pageId: PageId | null } }
  | { type: 'PREVIEW_TOGGLED' }
  | { type: 'REDACTION_ADDED'; payload: { pageId: PageId; redaction: RedactionArea } }
  | { type: 'REDACTION_REMOVED'; payload: { pageId: PageId; redactionId: string } }
  | { type: 'REDACTION_MODE_TOGGLED' }

  // Processing
  | { type: 'LOADING_STARTED'; payload: { message: string } }
  | { type: 'LOADING_FINISHED' }
  | { type: 'EXPORT_STARTED' }
  | { type: 'EXPORT_PROGRESS'; payload: { progress: number } }
  | { type: 'EXPORT_FINISHED' }
  | { type: 'PRINT_STARTED' }
  | { type: 'PRINT_FINISHED' }

  // AI
  | { type: 'GEMINI_API_KEY_SET'; payload: { key: string } }
  | { type: 'AI_PROCESSING_STARTED' }
  | { type: 'AI_SUGGESTIONS_RECEIVED'; payload: { suggestions: AiSplitSuggestion } }
  | { type: 'AI_SUGGESTIONS_APPLIED' }
  | { type: 'AI_SUGGESTIONS_DISMISSED' }
  | { type: 'AI_PROCESSING_FINISHED' }

  // Stamp & Evidence
  | { type: 'STAMP_ENABLED_TOGGLED' }
  | { type: 'STAMP_SETTINGS_UPDATED'; payload: { settings: Partial<StampSettings> } }
  | { type: 'EXPORT_MODE_SET'; payload: { mode: ExportMode } }
  | { type: 'EVIDENCE_NUMBER_SET'; payload: { segmentId: string; evidenceNumber: EvidenceNumber | null } }
  | { type: 'EVIDENCE_NUMBERS_AUTO_ASSIGN' }
  | { type: 'EVIDENCE_GROUP_CREATED'; payload: { segmentId: string; afterPageId: PageId } }
  | { type: 'EVIDENCE_GROUP_DISSOLVED'; payload: { segmentId: string } }
  | { type: 'GROUP_MERGE_TOGGLED'; payload: { groupId: string; mergeInExport: boolean } }
  | { type: 'GROUP_RENAMED'; payload: { groupId: string; name: string } }

  // Segment selection & grouping
  | { type: 'SEGMENT_SELECTED'; payload: { segmentId: string; additive: boolean } }
  | { type: 'SEGMENT_SELECTION_CLEARED' }
  | { type: 'SEGMENT_FOCUSED'; payload: { segmentId: string; withScroll?: boolean } }
  | { type: 'GROUP_FOCUSED'; payload: { groupId: string; withScroll?: boolean } }
  | { type: 'SEGMENTS_GROUPED' }
  | { type: 'SEGMENTS_UNGROUPED'; payload: { groupId: string } }
  | { type: 'GROUP_CHILD_REORDERED'; payload: { groupId: string; fromSegmentId: string; toSegmentId: string } }
  | { type: 'GROUP_SEGMENT_ADDED'; payload: { segmentId: string; groupId: string } }
  | { type: 'SEGMENT_EJECTED_FROM_GROUP'; payload: { segmentId: string; targetIndex: number } }

  // Reset
  | { type: 'STATE_RESET' }

  // Session save / restore (auto save / library)
  | { type: 'SESSION_ID_ASSIGNED'; payload: { id: string } }
  | { type: 'SESSION_SAVE_STARTED' }
  | { type: 'SESSION_SAVE_FINISHED'; payload: { savedAt: string } }
  | { type: 'SESSION_SAVE_FAILED' }
  | { type: 'SESSION_RESTORED'; payload: { state: Partial<AppState>; sessionId: string } }
  | { type: 'SESSION_NEW_STARTED' };
