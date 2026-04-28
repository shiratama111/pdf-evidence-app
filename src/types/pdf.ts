/** 一意なページ識別子: `${sourceFileId}_p${pageIndex}` */
export type PageId = string;

export interface RedactionArea {
  id: string;
  x: number; // PDF座標（左下原点）
  y: number;
  width: number;
  height: number;
}

/** アップロードされた元ファイル */
export interface SourceFile {
  id: string;
  name: string;
  arrayBuffer: ArrayBuffer;
  pageCount: number;
  fileSize: number;
  type: 'pdf' | 'image';
}

/** 1ページの情報 */
export interface PdfPage {
  id: PageId;
  sourceFileId: string;
  sourcePageIndex: number;
  rotation: number; // 0 | 90 | 180 | 270
  width: number;
  height: number;
  thumbnailUrl: string | null;
  redactions: RedactionArea[];
}

/** セグメント = 分割後の1ファイルに対応するページグループ */
export interface Segment {
  id: string;
  name: string;
  pageIds: PageId[];
  color: string;
  isCollapsed: boolean;
  /** 証拠番号 (例: { main: 1, sub: null } → 甲1, { main: 1, sub: 2 } → 甲1の2) */
  evidenceNumber: EvidenceNumber | null;
  /** グループID: 同じgroupIdを持つセグメントは枝番グループとして一体で移動する */
  groupId: string | null;
  /** グループ内の枝番を1つのPDFに統合してエクスポートするフラグ（グループ内全セグメントで同じ値を持つ） */
  mergeInExport?: boolean;
  /** グループ名（ユーザーが設定した場合、グループ内全セグメントで同じ値を持つ）。未設定時は undefined */
  groupName?: string;
}

/** 証拠番号 */
export interface EvidenceNumber {
  main: number;
  sub: number | null;
}

/** スタンプ設定 */
export interface StampSettings {
  symbol: string;       // 甲, 乙, 丙, 丁, 戊, 疎甲, 疎乙, 弁, 資料, __custom__
  customSymbol: string; // __custom__時に使う文字列
  format: StampFormat;
  fontSize: number;
  fontColor: string;    // black, red, blue
  marginTop: number;
  marginRight: number;
  showBorder: boolean;
  showBackground: boolean;
  removeMetadata: boolean;
  startNum: number;
}

export type StampFormat = 'mints' | 'mints-formal' | 'simple' | 'hyphen' | 'formal' | 'goushou';

export type ExportMode = 'split_pdfs' | 'zip';

/** AI分割提案 */
export interface AiSplitSuggestion {
  segments: AiSegmentSuggestion[];
}

export interface AiSegmentSuggestion {
  suggestedName: string;
  pageRange: [number, number]; // [startIndex, endIndex] (0-based, inclusive)
  documentType: string;
}

/** アプリ全体の状態 */
export interface AppState {
  sourceFiles: Record<string, SourceFile>;
  pages: Record<PageId, PdfPage>;
  segments: Segment[];
  selectedPageIds: PageId[];
  previewPageId: PageId | null;
  isPreviewOpen: boolean;
  isLoading: boolean;
  loadingMessage: string;
  isExporting: boolean;
  isPrinting: boolean;
  exportProgress: number;
  geminiApiKey: string | null;
  aiSuggestions: AiSplitSuggestion | null;
  isAiProcessing: boolean;
  stampEnabled: boolean;
  stampSettings: StampSettings;
  exportMode: ExportMode;
  selectedSegmentIds: string[];
  focusedSegmentId: string | null;
  focusedGroupId: string | null;
  focusVersion: number;
  redactionMode: boolean;
  /** 自動保存中のセッションID。null の場合は未保存（編集が始まったら付与される） */
  currentSessionId: string | null;
  /** 最終自動保存日時（ISO8601）。null の場合は未保存 */
  lastSavedAt: string | null;
  /** 自動保存ステータス（ヘッダーインジケータ表示用） */
  saveStatus: 'idle' | 'saving' | 'saved' | 'failed';
}
