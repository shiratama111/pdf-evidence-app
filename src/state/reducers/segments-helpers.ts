import type { AppState, PageId, Segment } from '@/types/pdf';
import { getSegmentColor } from '@/constants/defaults';
import { recolorSegments } from './reducer-helpers';

export function splitSegmentAt(state: AppState, segmentId: string, afterPageId: PageId): AppState {
  const segIdx = state.segments.findIndex(segment => segment.id === segmentId);
  if (segIdx === -1) return state;

  const seg = state.segments[segIdx];
  const splitIdx = seg.pageIds.indexOf(afterPageId);
  if (splitIdx === -1 || splitIdx === seg.pageIds.length - 1) return state;

  const firstPageIds = seg.pageIds.slice(0, splitIdx + 1);
  const secondPageIds = seg.pageIds.slice(splitIdx + 1);
  const newSeg1 = { ...seg, pageIds: firstPageIds };
  const newSeg2: Segment = {
    id: crypto.randomUUID(),
    name: `${seg.name}_${segIdx + 2}`,
    pageIds: secondPageIds,
    color: '',
    isCollapsed: false,
    evidenceNumber: seg.groupId && seg.evidenceNumber
      ? { main: seg.evidenceNumber.main, sub: 0 }
      : null,
    groupId: seg.groupId,
    groupName: seg.groupName,
    mergeInExport: seg.mergeInExport,
  };
  const splitSegments = [...state.segments];
  splitSegments.splice(segIdx, 1, newSeg1, newSeg2);

  let finalSegments = splitSegments;
  if (seg.groupId && seg.evidenceNumber) {
    const groupMainNum = seg.evidenceNumber.main;
    let subCounter = 1;
    finalSegments = splitSegments.map(segment => {
      if (segment.groupId === seg.groupId) {
        const updated = { ...segment, evidenceNumber: { main: groupMainNum, sub: subCounter } };
        subCounter++;
        return updated;
      }
      return segment;
    });
  }

  return { ...state, segments: recolorSegments(finalSegments) };
}

export function deleteSegment(state: AppState, segmentId: string): AppState {
  const seg = state.segments.find(segment => segment.id === segmentId);
  if (!seg) return state;

  const deletedPageIds = new Set(seg.pageIds);
  const newPages = { ...state.pages };
  for (const pageId of seg.pageIds) delete newPages[pageId];

  return {
    ...state,
    pages: newPages,
    segments: recolorSegments(state.segments.filter(segment => segment.id !== segmentId)),
    selectedPageIds: state.selectedPageIds.filter(pageId => !deletedPageIds.has(pageId)),
  };
}

export function mergeAllSegments(state: AppState): AppState {
  if (state.segments.length <= 1) return state;

  const allPageIds = state.segments.flatMap(segment => segment.pageIds);
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

export function mergeSegmentWithNext(state: AppState, segmentId: string): AppState {
  const idx = state.segments.findIndex(segment => segment.id === segmentId);
  if (idx === -1 || idx >= state.segments.length - 1) return state;

  const current = state.segments[idx];
  const next = state.segments[idx + 1];
  const merged = { ...current, pageIds: [...current.pageIds, ...next.pageIds] };
  const newSegments = [...state.segments];
  newSegments.splice(idx, 2, merged);
  return { ...state, segments: recolorSegments(newSegments) };
}

export function bulkReorderSegments(state: AppState, segmentIds: string[]): AppState {
  const segmentMap = new Map(state.segments.map(segment => [segment.id, segment]));
  const reordered = segmentIds.map(id => segmentMap.get(id)!).filter(Boolean);
  return { ...state, segments: recolorSegments(reordered) };
}

export function movePages(state: AppState, pageIds: PageId[], targetSegmentId: string, targetIndex: number): AppState {
  const movedSet = new Set(pageIds);
  let newSegments = state.segments.map(segment => ({
    ...segment,
    pageIds: segment.pageIds.filter(pageId => !movedSet.has(pageId)),
  }));

  newSegments = newSegments.map(segment => {
    if (segment.id !== targetSegmentId) return segment;
    const newPageIds = [...segment.pageIds];
    newPageIds.splice(targetIndex, 0, ...pageIds);
    return { ...segment, pageIds: newPageIds };
  });

  return {
    ...state,
    segments: recolorSegments(newSegments.filter(segment => segment.pageIds.length > 0)),
  };
}

export function reorderSegments(state: AppState, fromIndex: number, toIndex: number): AppState {
  const newSegments = [...state.segments];
  const movedSeg = newSegments[fromIndex];

  if (movedSeg.groupId) {
    const groupSegs: number[] = [];
    newSegments.forEach((segment, index) => {
      if (segment.groupId === movedSeg.groupId) groupSegs.push(index);
    });

    const extracted = groupSegs.map(index => newSegments[index]);
    for (let i = groupSegs.length - 1; i >= 0; i--) newSegments.splice(groupSegs[i], 1);

    const insertAt = Math.min(
      Math.max(0, toIndex < fromIndex ? toIndex : toIndex - groupSegs.length + 1),
      newSegments.length,
    );
    newSegments.splice(insertAt, 0, ...extracted);
  } else {
    const [moved] = newSegments.splice(fromIndex, 1);
    newSegments.splice(toIndex, 0, moved);
  }

  return { ...state, segments: recolorSegments(newSegments) };
}

export function createEvidenceGroup(state: AppState, segmentId: string, afterPageId: PageId): AppState {
  const segIdx = state.segments.findIndex(segment => segment.id === segmentId);
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
  return { ...state, segments: recolorSegments(newSegments) };
}

export function groupSelectedSegments(state: AppState): AppState {
  if (state.selectedSegmentIds.length < 2) return state;

  const groupId = crypto.randomUUID();
  const selectedIndices = state.selectedSegmentIds
    .map(id => state.segments.findIndex(segment => segment.id === id))
    .filter(index => index !== -1)
    .sort((a, b) => a - b);
  const firstSeg = state.segments[selectedIndices[0]];
  const mainNum = firstSeg.evidenceNumber?.main ?? (selectedIndices[0] + state.stampSettings.startNum);

  const newSegments = state.segments.map(segment => {
    if (!state.selectedSegmentIds.includes(segment.id)) return segment;
    const subNum = selectedIndices.indexOf(state.segments.indexOf(segment)) + 1;
    return {
      ...segment,
      groupId,
      evidenceNumber: { main: mainNum, sub: subNum },
    };
  });

  return { ...state, segments: recolorSegments(newSegments), selectedSegmentIds: [] };
}

export function reorderGroupChildren(
  state: AppState,
  groupId: string,
  fromSegmentId: string,
  toSegmentId: string,
): AppState {
  const groupIndices: number[] = [];
  state.segments.forEach((segment, index) => {
    if (segment.groupId === groupId) groupIndices.push(index);
  });
  if (groupIndices.length < 2) return state;

  const fromIdx = groupIndices.findIndex(index => state.segments[index].id === fromSegmentId);
  const toIdx = groupIndices.findIndex(index => state.segments[index].id === toSegmentId);
  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return state;

  const groupSegs = groupIndices.map(index => state.segments[index]);
  const [moved] = groupSegs.splice(fromIdx, 1);
  groupSegs.splice(toIdx, 0, moved);

  const mainNum = groupSegs[0].evidenceNumber?.main ?? 1;
  const renumbered = groupSegs.map((segment, index) => ({
    ...segment,
    evidenceNumber: { main: mainNum, sub: index + 1 },
  }));

  const newSegments = [...state.segments];
  groupIndices.forEach((origIdx, index) => {
    newSegments[origIdx] = renumbered[index];
  });

  return { ...state, segments: newSegments };
}
