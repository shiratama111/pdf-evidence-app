import type { StampSettings } from '@/types/pdf';

/** Segment color palette */
export const SEGMENT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#F97316', // orange
  '#6366F1', // indigo
];

export function getSegmentColor(index: number): string {
  return SEGMENT_COLORS[index % SEGMENT_COLORS.length];
}

/** 証拠符号の選択肢 */
export const SYMBOL_OPTIONS = [
  { value: '甲', label: '甲' },
  { value: '乙', label: '乙' },
  { value: '丙', label: '丙' },
  { value: '丁', label: '丁' },
  { value: '戊', label: '戊' },
  { value: '疎甲', label: '疎甲' },
  { value: '疎乙', label: '疎乙' },
  { value: '弁', label: '弁' },
  { value: '資料', label: '資料' },
  { value: '__custom__', label: 'カスタム' },
];

/** 番号フォーマットの選択肢 */
export const FORMAT_OPTIONS = [
  { value: 'mints-formal', label: 'mints提出', example: '甲001 / 甲第1号証' },
  { value: 'goushou', label: '号証', example: '甲1号証' },
  { value: 'formal', label: '正式', example: '甲第1号証' },
  { value: 'mints', label: 'mints', example: '甲001' },
  { value: 'simple', label: 'シンプル', example: '甲1' },
  { value: 'hyphen', label: 'ハイフン', example: '甲1-1' },
] as const;

/** デフォルトのスタンプ設定 */
export const DEFAULT_STAMP_SETTINGS: StampSettings = {
  symbol: '甲',
  customSymbol: '',
  format: 'mints-formal',
  fontSize: 14,
  fontColor: 'red',
  marginTop: 15,
  marginRight: 15,
  showBorder: false,
  showBackground: true,
  removeMetadata: false,
  startNum: 1,
};
