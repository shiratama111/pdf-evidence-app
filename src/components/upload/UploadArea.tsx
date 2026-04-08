import { useCallback, useRef, useState } from 'react';
import { Upload, FileUp } from 'lucide-react';
import { usePdfLoader } from '@/hooks/usePdfLoader';

export function UploadArea() {
  const { loadFiles } = usePdfLoader();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      loadFiles(e.dataTransfer.files);
    }
  }, [loadFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      loadFiles(e.target.files);
      e.target.value = '';
    }
  }, [loadFiles]);

  return (
    <div
      className={`flex flex-col items-center justify-center h-full cursor-pointer rounded-2xl border-2 border-dashed transition-colors ${
        isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50'
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
    >
      <div className="flex flex-col items-center gap-4 p-12">
        {isDragging ? (
          <FileUp className="w-16 h-16 text-blue-500" />
        ) : (
          <Upload className="w-16 h-16 text-gray-400" />
        )}
        <div className="text-center">
          <p className="text-lg font-medium text-gray-700">
            PDFまたは画像ファイルをドロップ
          </p>
          <p className="text-sm text-gray-500 mt-1">
            またはクリックしてファイルを選択
          </p>
          <p className="text-xs text-gray-400 mt-2">
            PDF, JPG, PNG に対応（複数ファイル可）
          </p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        multiple
        onChange={handleChange}
      />
    </div>
  );
}
