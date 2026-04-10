import type { AppState, Segment } from '@/types/pdf';
import { getSegmentColor } from '@/constants/defaults';

export function recolorSegments(segments: Segment[]): Segment[] {
  return segments.map((segment, index) => ({ ...segment, color: getSegmentColor(index) }));
}

export function autoAssignEvidenceNumbers(state: AppState): AppState {
  let num = state.stampSettings.startNum;
  const newSegments: typeof state.segments = [];
  const processedGroups = new Set<string>();

  for (let i = 0; i < state.segments.length; i++) {
    const seg = state.segments[i];

    if (seg.groupId) {
      if (processedGroups.has(seg.groupId)) {
        newSegments.push(seg);
        continue;
      }

      processedGroups.add(seg.groupId);
      const mainNum = num;
      num++;
      let sub = 1;

      for (let j = i; j < state.segments.length; j++) {
        if (state.segments[j].groupId !== seg.groupId) break;
        newSegments.push({
          ...state.segments[j],
          evidenceNumber: { main: mainNum, sub },
        });
        sub++;
      }

      i += sub - 2;
    } else {
      newSegments.push({ ...seg, evidenceNumber: { main: num, sub: null } });
      num++;
    }
  }

  return { ...state, segments: newSegments };
}
