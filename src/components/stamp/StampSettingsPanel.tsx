import { useAppState, useAppDispatch } from '@/state/AppContext';
import { SYMBOL_OPTIONS, FORMAT_OPTIONS } from '@/constants/defaults';
import { X } from 'lucide-react';

export function StampSettingsPanel() {
  const { stampEnabled, stampSettings } = useAppState();
  const dispatch = useAppDispatch();

  if (!stampEnabled) return null;

  const update = (settings: Partial<typeof stampSettings>) => {
    dispatch({ type: 'STAMP_SETTINGS_UPDATED', payload: { settings } });
  };

  return (
    <div className="w-60 flex-shrink-0 border-l border-gray-200 bg-white flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">スタンプ設定</h3>
        <button
          onClick={() => dispatch({ type: 'STAMP_ENABLED_TOGGLED' })}
          className="p-1 rounded hover:bg-gray-100 text-gray-400"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* 符号 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">符号</label>
          <select
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
            value={stampSettings.symbol}
            onChange={(e) => update({ symbol: e.target.value })}
          >
            {SYMBOL_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {stampSettings.symbol === '__custom__' && (
            <input
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm mt-1"
              placeholder="カスタム符号"
              value={stampSettings.customSymbol}
              onChange={(e) => update({ customSymbol: e.target.value })}
            />
          )}
        </div>

        {/* フォーマット */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">番号形式</label>
          <div className="space-y-1">
            {FORMAT_OPTIONS.map(opt => (
              <label
                key={opt.value}
                className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                  stampSettings.format === opt.value
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  className="mt-0.5"
                  checked={stampSettings.format === opt.value}
                  onChange={() => update({ format: opt.value })}
                />
                <div>
                  <div className="text-sm font-medium text-gray-700">{opt.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{opt.example}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* 開始番号 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">開始番号</label>
          <input
            type="number"
            min={1}
            className="w-20 border border-gray-200 rounded px-2 py-1.5 text-sm"
            value={stampSettings.startNum}
            onChange={(e) => update({ startNum: parseInt(e.target.value) || 1 })}
          />
        </div>

        {/* フォントサイズ */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            フォントサイズ: {stampSettings.fontSize}pt
          </label>
          <input
            type="range"
            min={6}
            max={36}
            className="w-full"
            value={stampSettings.fontSize}
            onChange={(e) => update({ fontSize: parseInt(e.target.value) })}
          />
        </div>

        {/* 色 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">色</label>
          <div className="flex gap-2">
            {(['black', 'red', 'blue'] as const).map(color => (
              <button
                key={color}
                className={`px-3 py-1 text-sm rounded border ${
                  stampSettings.fontColor === color
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => update({ fontColor: color })}
              >
                <span style={{ color: color === 'black' ? '#000' : color === 'red' ? '#cc0000' : '#0000cc' }}>
                  {color === 'black' ? '黒' : color === 'red' ? '赤' : '青'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* マージン */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">上マージン</label>
            <input
              type="number"
              min={0}
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
              value={stampSettings.marginTop}
              onChange={(e) => update({ marginTop: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">右マージン</label>
            <input
              type="number"
              min={0}
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
              value={stampSettings.marginRight}
              onChange={(e) => update({ marginRight: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>

        {/* チェックボックス */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={stampSettings.showBackground}
              onChange={(e) => update({ showBackground: e.target.checked })}
            />
            白背景
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={stampSettings.showBorder}
              onChange={(e) => update({ showBorder: e.target.checked })}
            />
            枠線
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={stampSettings.removeMetadata}
              onChange={(e) => update({ removeMetadata: e.target.checked })}
            />
            メタデータ削除
          </label>
        </div>
      </div>
    </div>
  );
}
