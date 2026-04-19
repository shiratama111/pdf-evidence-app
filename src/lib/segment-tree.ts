/**
 * segment-tree.ts
 *
 * セグメント配列から「単独セグメント」と「グループ」のツリー構造を組み立てる共通ユーティリティ。
 *
 * 用途:
 * - 左サイドバー (SegmentList) のD&D並び替え
 * - 中央PDF画面 (ThumbnailGrid) のD&D並び替え
 *
 * 仕様:
 * - 同じ groupId を持つセグメントは連続している前提（appReducer側で保証）
 * - グループ全体を1つのトップレベル item として扱う → グループ一体移動の基礎
 */
import type { Segment } from '@/types/pdf';

export type TreeSegment = { segment: Segment; originalIndex: number };

export type TreeItem =
  | { kind: 'single'; segment: Segment; originalIndex: number }
  | { kind: 'group'; groupId: string; mainNum: number; segments: TreeSegment[] };

export function buildSegmentTree(segments: Segment[]): TreeItem[] {
  const items: TreeItem[] = [];
  let index = 0;

  while (index < segments.length) {
    const segment = segments[index];
    if (!segment.groupId) {
      items.push({ kind: 'single', segment, originalIndex: index });
      index += 1;
      continue;
    }

    const groupId = segment.groupId;
    const groupSegments: TreeSegment[] = [];
    while (index < segments.length && segments[index].groupId === groupId) {
      groupSegments.push({ segment: segments[index], originalIndex: index });
      index += 1;
    }

    items.push({
      kind: 'group',
      groupId,
      mainNum: groupSegments[0].segment.evidenceNumber?.main ?? 0,
      segments: groupSegments,
    });
  }

  return items;
}

export function getTreeItemId(item: TreeItem): string {
  return item.kind === 'group' ? `grp_${item.groupId}` : item.segment.id;
}

/**
 * ツリーを平坦化してセグメントIDの配列に戻す。
 * D&D で並び替えた後、SEGMENTS_BULK_REORDERED のペイロードに使う。
 */
export function flattenTreeToSegmentIds(tree: TreeItem[]): string[] {
  return tree.flatMap((item) => (
    item.kind === 'single'
      ? [item.segment.id]
      : item.segments.map(({ segment }) => segment.id)
  ));
}
