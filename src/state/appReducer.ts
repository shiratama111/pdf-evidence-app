import type { AppState, Segment } from '@/types/pdf';
import type { AppAction } from './actions';
import { getSegmentColor, DEFAULT_STAMP_SETTINGS } from '@/constants/defaults';

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
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    // ── File operations ──
    case 'FILES_LOADED': {
      const newSourceFiles = { ...state.sourceFiles };
      const newPages = { ...state.pages };
      for (const sf of action.payload.sourceFiles) {
        newSourceFiles[sf.id] = sf;
      }
      for (const p of action.payload.pages) {
        newPages[p.id] = p;
      }
      const allSegments = [...state.segments, ...action.payload.segments];
      const colored = allSegments.map((s, i) => ({ ...s, color: getSegmentColor(i) }));
      return { ...state, sourceFiles: newSourceFiles, pages: newPages, segments: colored, isLoading: false };
    }

    // ── Page operations ──
    case 'PAGES_ROTATED': {
      const newPages = { ...state.pages };
      for (const pid of action.payload.pageIds) {
        const page = newPages[pid];
        if (page) {
          const newRotation = (page.rotation + action.payload.degrees + 360) % 360;
          newPages[pid] = { ...page, rotation: newRotation, thumbnailUrl: null };
        }
      }
      return { ...state, pages: newPages };
    }

    case 'PAGES_DELETED': {
      const deletedSet = new Set(action.payload.pageIds);
      const newSegments = state.segments
        .map(seg => ({ ...seg, pageIds: seg.pageIds.filter(pid => !deletedSet.has(pid)) }))
        .filter(seg => seg.pageIds.length > 0);
      const newPages = { ...state.pages };
      for (const pid of action.payload.pageIds) delete newPages[pid];
      const colored = newSegments.map((s, i) => ({ ...s, color: getSegmentColor(i) }));
      return {
        ...state,
        pages: newPages,
        segments: colored,
        selectedPageIds: state.selectedPageIds.filter(pid => !deletedSet.has(pid)),
        previewPageId: deletedSet.has(state.previewPageId ?? '') ? null : state.previewPageId,
      };
    }

    case 'PAGE_THUMBNAIL_READY': {
      const page = state.pages[action.payload.pageId];
      if (!page) return state;
      return {
        ...state,
        pages: { ...state.pages, [action.payload.pageId]: { ...page, thumbnailUrl: action.payload.thumbnailUrl } },
      };
    }

    // ── Segment operations ──
    case 'SEGMENT_SPLIT_AT': {
      const { segmentId, afterPageId } = action.payload;
      const segIdx = state.segments.findIndex(s => s.id === segmentId);
      if (segIdx === -1) return state;
      const seg = state.segments[segIdx];
      const splitIdx = seg.pageIds.indexOf(afterPageId);
      if (splitIdx === -1 || splitIdx === seg.pageIds.length - 1) return state;

      const firstPageIds = seg.pageIds.slice(0, splitIdx + 1);
      const secondPageIds = seg.pageIds.slice(splitIdx + 1);
      const newSeg1 = { ...seg, pageIds: firstPageIds };
      // 分割後の新セグメントは、元のセグメントがグループ所属なら同じグループに所属させる
      const newSeg2: Segment = {
        id: crypto.randomUUID(),
        name: `${seg.name}_${segIdx + 2}`,
        pageIds: secondPageIds,
        color: '',
        isCollapsed: false,
        // グループ所属なら main を引き継ぎ（sub は後で再採番）、非所属なら null
        evidenceNumber: seg.groupId && seg.evidenceNumber
          ? { main: seg.evidenceNumber.main, sub: 0 }
          : null,
        groupId: seg.groupId,
        groupName: seg.groupName,
        mergeInExport: seg.mergeInExport,
      };
      const splitSegments = [...state.segments];
      splitSegments.splice(segIdx, 1, newSeg1, newSeg2);

      // グループ所属なら同グループ内のsubを位置順に再採番
      let finalSegments = splitSegments;
      if (seg.groupId && seg.evidenceNumber) {
        const groupMainNum = seg.evidenceNumber.main;
        let subCounter = 1;
        finalSegments = splitSegments.map(s => {
          if (s.groupId === seg.groupId) {
            const updated = { ...s, evidenceNumber: { main: groupMainNum, sub: subCounter } };
            subCounter++;
            return updated;
          }
          return s;
        });
      }

      const colored = finalSegments.map((s, i) => ({ ...s, color: getSegmentColor(i) }));
      return { ...state, segments: colored };
    }

    case 'SEGMENT_RENAMED':
      return {
        ...state,
        segments: state.segments.map(s =>
          s.id === action.payload.segmentId ? { ...s, name: action.payload.name } : s
        ),
      };

    case 'SEGMENT_DELETED': {
      const seg = state.segments.find(s => s.id === action.payload.segmentId);
      if (!seg) return state;
      const deletedPageIds = new Set(seg.pageIds);
      const newPages = { ...state.pages };
      for (const pid of seg.pageIds) delete newPages[pid];
      const newSegments = state.segments
        .filter(s => s.id !== action.payload.segmentId)
        .map((s, i) => ({ ...s, color: getSegmentColor(i) }));
      return {
        ...state,
        pages: newPages,
        segments: newSegments,
        selectedPageIds: state.selectedPageIds.filter(pid => !deletedPageIds.has(pid)),
      };
    }

    case 'SEGMENTS_MERGE_ALL': {
      if (state.segments.length <= 1) return state;
      const allPageIds = state.segments.flatMap(s => s.pageIds);
      const merged = {
        id: state.segments[0].id,
        name: 'Document',
        pageIds: allPageIds,
        color: getSegmentColor(0),
        isCollapsed: false,
        evidenceNumber: null,
        groupId: null,
      };
      return { ...state, segments: [merged] };
    }

    case 'SEGMENTS_MERGE': {
      const { segmentId } = action.payload;
      const idx = state.segments.findIndex(s => s.id === segmentId);
      if (idx === -1 || idx >= state.segments.length - 1) return state;
      const current = state.segments[idx];
      const next = state.segments[idx + 1];
      const merged = { ...current, pageIds: [...current.pageIds, ...next.pageIds] };
      const newSegments = [...state.segments];
      newSegments.splice(idx, 2, merged);
      const colored = newSegments.map((s, i) => ({ ...s, color: getSegmentColor(i) }));
      return { ...state, segments: colored };
    }

    case 'SEGMENTS_BULK_REORDERED': {
      const idOrder = action.payload.segmentIds;
      const segMap = new Map(state.segments.map(s => [s.id, s]));
      const reordered = idOrder.map(id => segMap.get(id)!).filter(Boolean);
      const colored = reordered.map((s, i) => ({ ...s, color: getSegmentColor(i) }));
      return { ...state, segments: colored };
    }

    // ── D&D ──
    case 'PAGES_MOVED': {
      const { pageIds, targetSegmentId, targetIndex } = action.payload;
      const movedSet = new Set(pageIds);
      let newSegments = state.segments.map(seg => ({
        ...seg, pageIds: seg.pageIds.filter(pid => !movedSet.has(pid)),
      }));
      newSegments = newSegments.map(seg => {
        if (seg.id !== targetSegmentId) return seg;
        const newPageIds = [...seg.pageIds];
        newPageIds.splice(targetIndex, 0, ...pageIds);
        return { ...seg, pageIds: newPageIds };
      });
      newSegments = newSegments.filter(seg => seg.pageIds.length > 0);
      const colored = newSegments.map((s, i) => ({ ...s, color: getSegmentColor(i) }));
      return { ...state, segments: colored };
    }

    case 'SEGMENT_REORDERED': {
      const { fromIndex, toIndex } = action.payload;
      const newSegments = [...state.segments];
      const movedSeg = newSegments[fromIndex];
      // グループ一体移動: 同じgroupIdを持つセグメントをまとめて移動
      if (movedSeg.groupId) {
        const groupSegs: number[] = [];
        newSegments.forEach((s, i) => { if (s.groupId === movedSeg.groupId) groupSegs.push(i); });
        // グループ全体を抽出
        const extracted = groupSegs.map(i => newSegments[i]);
        // 元の位置から削除（後ろから削除して index がずれないように）
        for (let i = groupSegs.length - 1; i >= 0; i--) newSegments.splice(groupSegs[i], 1);
        // 挿入位置を計算
        const insertAt = Math.min(Math.max(0, toIndex < fromIndex ? toIndex : toIndex - groupSegs.length + 1), newSegments.length);
        newSegments.splice(insertAt, 0, ...extracted);
      } else {
        const [moved] = newSegments.splice(fromIndex, 1);
        newSegments.splice(toIndex, 0, moved);
      }
      const colored = newSegments.map((s, i) => ({ ...s, color: getSegmentColor(i) }));
      return { ...state, segments: colored };
    }

    // ── UI ──
    case 'PAGE_SELECTED': {
      const { pageId, additive } = action.payload;
      if (additive) {
        const exists = state.selectedPageIds.includes(pageId);
        return {
          ...state,
          selectedPageIds: exists
            ? state.selectedPageIds.filter(pid => pid !== pageId)
            : [...state.selectedPageIds, pageId],
        };
      }
      return { ...state, selectedPageIds: [pageId] };
    }

    case 'SELECTION_CLEARED':
      return { ...state, selectedPageIds: [] };

    case 'PREVIEW_SET':
      return { ...state, previewPageId: action.payload.pageId, isPreviewOpen: action.payload.pageId !== null };

    case 'PREVIEW_TOGGLED':
      return { ...state, isPreviewOpen: !state.isPreviewOpen };

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

    case 'REDACTION_MODE_TOGGLED':
      return { ...state, redactionMode: !state.redactionMode };

    // ── Processing ──
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

    // ── AI ──
    case 'GEMINI_API_KEY_SET':
      localStorage.setItem('waketena_gemini_key', action.payload.key);
      return { ...state, geminiApiKey: action.payload.key };

    case 'AI_PROCESSING_STARTED':
      return { ...state, isAiProcessing: true, aiSuggestions: null };

    case 'AI_SUGGESTIONS_RECEIVED':
      return { ...state, aiSuggestions: action.payload.suggestions, isAiProcessing: false };

    case 'AI_SUGGESTIONS_APPLIED': {
      if (!state.aiSuggestions) return state;
      const allPageIds = state.segments.flatMap(s => s.pageIds);
      const newSegments = state.aiSuggestions.segments.map((sug, i) => ({
        id: crypto.randomUUID(),
        name: sug.suggestedName,
        pageIds: allPageIds.slice(sug.pageRange[0], sug.pageRange[1] + 1),
        color: getSegmentColor(i),
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

    // ── Stamp & Evidence ──
    case 'STAMP_ENABLED_TOGGLED': {
      const newStampEnabled = !state.stampEnabled;
      if (!newStampEnabled) {
        return { ...state, stampEnabled: false };
      }
      // ONにしたとき、自動採番も実行
      return appReducer({ ...state, stampEnabled: true }, { type: 'EVIDENCE_NUMBERS_AUTO_ASSIGN' });
    }

    case 'STAMP_SETTINGS_UPDATED': {
      const newSettings = { ...state.stampSettings, ...action.payload.settings };
      localStorage.setItem('waketena_stamp_settings', JSON.stringify(newSettings));
      return { ...state, stampSettings: newSettings };
    }

    case 'EXPORT_MODE_SET':
      return { ...state, exportMode: action.payload.mode };

    case 'EVIDENCE_NUMBER_SET':
      return {
        ...state,
        segments: state.segments.map(s =>
          s.id === action.payload.segmentId
            ? { ...s, evidenceNumber: action.payload.evidenceNumber }
            : s
        ),
      };

    case 'EVIDENCE_NUMBERS_AUTO_ASSIGN': {
      let num = state.stampSettings.startNum;
      const newSegments: typeof state.segments = [];
      const processedGroups = new Set<string>();

      for (let i = 0; i < state.segments.length; i++) {
        const seg = state.segments[i];

        if (seg.groupId) {
          if (processedGroups.has(seg.groupId)) {
            // 同グループの後続 → 既にmainNumが決まっている
            newSegments.push(seg); // 後でまとめて枝番を振る
            continue;
          }
          // グループの最初のセグメント → このグループ全体で1つのmainNum
          processedGroups.add(seg.groupId);
          const mainNum = num;
          num++;
          // グループ内の全セグメントに枝番を振る
          let sub = 1;
          for (let j = i; j < state.segments.length; j++) {
            if (state.segments[j].groupId !== seg.groupId) break;
            newSegments.push({
              ...state.segments[j],
              evidenceNumber: { main: mainNum, sub },
            });
            sub++;
          }
          // 既にグループ分をpushしたのでスキップ
          i += sub - 2; // -1 (for文のi++) + -1 (最初の1つは既にカウント)
        } else {
          // グループ外 → 単独番号
          newSegments.push({ ...seg, evidenceNumber: { main: num, sub: null } });
          num++;
        }
      }

      return { ...state, segments: newSegments };
    }

    case 'EVIDENCE_GROUP_CREATED': {
      const { segmentId, afterPageId } = action.payload;
      const segIdx = state.segments.findIndex(s => s.id === segmentId);
      if (segIdx === -1) return state;
      const seg = state.segments[segIdx];
      const splitIdx = seg.pageIds.indexOf(afterPageId);
      if (splitIdx === -1 || splitIdx === seg.pageIds.length - 1) return state;

      const mainNum = seg.evidenceNumber?.main ?? (segIdx + state.stampSettings.startNum);
      const firstPageIds = seg.pageIds.slice(0, splitIdx + 1);
      const secondPageIds = seg.pageIds.slice(splitIdx + 1);

      const newSeg1 = { ...seg, pageIds: firstPageIds, evidenceNumber: { main: mainNum, sub: 1 } };
      const newSeg2 = {
        id: crypto.randomUUID(),
        name: `${seg.name}_2`,
        pageIds: secondPageIds,
        color: '',
        isCollapsed: false,
        evidenceNumber: { main: mainNum, sub: 2 },
        groupId: null,
      };
      const newSegments = [...state.segments];
      newSegments.splice(segIdx, 1, newSeg1, newSeg2);
      const colored = newSegments.map((s, i) => ({ ...s, color: getSegmentColor(i) }));
      return { ...state, segments: colored };
    }

    case 'EVIDENCE_GROUP_DISSOLVED': {
      const seg = state.segments.find(s => s.id === action.payload.segmentId);
      if (!seg || !seg.evidenceNumber) return state;
      return {
        ...state,
        segments: state.segments.map(s =>
          s.id === action.payload.segmentId
            ? { ...s, evidenceNumber: { main: seg.evidenceNumber!.main, sub: null } }
            : s
        ),
      };
    }

    // ── Segment selection & grouping ──
    case 'SEGMENT_SELECTED': {
      const { segmentId, additive } = action.payload;
      if (additive) {
        const exists = state.selectedSegmentIds.includes(segmentId);
        return {
          ...state,
          selectedSegmentIds: exists
            ? state.selectedSegmentIds.filter(id => id !== segmentId)
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
        // withScroll: false の場合は focusVersion を据え置き、ThumbnailGrid の自動スクロールを抑制
        focusVersion: action.payload.withScroll === false ? state.focusVersion : state.focusVersion + 1,
      };

    case 'GROUP_FOCUSED':
      return {
        ...state,
        focusedGroupId: action.payload.groupId,
        focusedSegmentId: null,
        focusVersion: action.payload.withScroll === false ? state.focusVersion : state.focusVersion + 1,
      };

    case 'SEGMENTS_GROUPED': {
      if (state.selectedSegmentIds.length < 2) return state;
      const groupId = crypto.randomUUID();
      // 選択されたセグメントのうち最初のものの証拠番号のmainを使う（なければ自動算出）
      const selectedIndices = state.selectedSegmentIds
        .map(id => state.segments.findIndex(s => s.id === id))
        .filter(i => i !== -1)
        .sort((a, b) => a - b);
      const firstSeg = state.segments[selectedIndices[0]];
      const mainNum = firstSeg.evidenceNumber?.main ?? (selectedIndices[0] + state.stampSettings.startNum);

      const newSegments = state.segments.map((seg, _i) => {
        if (!state.selectedSegmentIds.includes(seg.id)) return seg;
        const subNum = selectedIndices.indexOf(state.segments.indexOf(seg)) + 1;
        return {
          ...seg,
          groupId,
          evidenceNumber: { main: mainNum, sub: subNum },
        };
      });
      const colored = newSegments.map((s, i) => ({ ...s, color: getSegmentColor(i) }));
      return { ...state, segments: colored, selectedSegmentIds: [] };
    }

    case 'SEGMENTS_UNGROUPED': {
      const { groupId } = action.payload;
      const newSegments = state.segments.map(s =>
        s.groupId === groupId
          ? { ...s, groupId: null, evidenceNumber: s.evidenceNumber ? { main: s.evidenceNumber.main, sub: null } : null, mergeInExport: undefined, groupName: undefined }
          : s
      );
      return { ...state, segments: newSegments };
    }

    case 'GROUP_MERGE_TOGGLED': {
      const { groupId, mergeInExport } = action.payload;
      const newSegments = state.segments.map(s =>
        s.groupId === groupId ? { ...s, mergeInExport } : s
      );
      return { ...state, segments: newSegments };
    }

    case 'GROUP_RENAMED': {
      const { groupId, name } = action.payload;
      const trimmed = name.trim();
      const newSegments = state.segments.map(s =>
        s.groupId === groupId
          ? { ...s, groupName: trimmed.length > 0 ? trimmed : undefined }
          : s
      );
      return { ...state, segments: newSegments };
    }

    case 'GROUP_CHILD_REORDERED': {
      const { groupId, fromSegmentId, toSegmentId } = action.payload;
      // グループ内のセグメントだけを抽出
      const groupIndices: number[] = [];
      state.segments.forEach((s, i) => { if (s.groupId === groupId) groupIndices.push(i); });
      if (groupIndices.length < 2) return state;

      const fromIdx = groupIndices.findIndex(i => state.segments[i].id === fromSegmentId);
      const toIdx = groupIndices.findIndex(i => state.segments[i].id === toSegmentId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return state;

      // グループ内の並び順を入れ替え
      const groupSegs = groupIndices.map(i => state.segments[i]);
      const [moved] = groupSegs.splice(fromIdx, 1);
      groupSegs.splice(toIdx, 0, moved);

      // 枝番を振り直す
      const mainNum = groupSegs[0].evidenceNumber?.main ?? 1;
      const renumbered = groupSegs.map((s, i) => ({
        ...s,
        evidenceNumber: { main: mainNum, sub: i + 1 },
      }));

      // 元の配列に戻す
      const newSegments = [...state.segments];
      groupIndices.forEach((origIdx, i) => {
        newSegments[origIdx] = renumbered[i];
      });

      return { ...state, segments: newSegments };
    }

    // ── Reset ──
    case 'STATE_RESET':
      return { ...initialState, geminiApiKey: state.geminiApiKey, stampSettings: state.stampSettings };

    default:
      return state;
  }
}
