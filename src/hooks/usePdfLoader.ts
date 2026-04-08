import { useCallback } from 'react';
import { useAppDispatch } from '@/state/AppContext';
import { loadPdfDocument, getPageInfo } from '@/lib/pdf-renderer';
import { imageToPdfBuffer } from '@/lib/image-to-pdf';
import type { PdfPage, Segment, SourceFile } from '@/types/pdf';
import { getSegmentColor } from '@/constants/defaults';

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export function usePdfLoader() {
  const dispatch = useAppDispatch();

  const loadFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    dispatch({ type: 'LOADING_STARTED', payload: { message: 'ファイルを読み込み中...' } });

    try {
      const allSourceFiles: SourceFile[] = [];
      const allPages: PdfPage[] = [];
      const allSegments: Segment[] = [];

      for (const file of files) {
        const isImage = IMAGE_TYPES.includes(file.type);
        let arrayBuffer = await file.arrayBuffer();

        if (isImage) {
          arrayBuffer = await imageToPdfBuffer(arrayBuffer, file.type);
        }

        const fileId = crypto.randomUUID();
        const doc = await loadPdfDocument(arrayBuffer, fileId);
        const pageCount = doc.numPages;

        const sourceFile: SourceFile = {
          id: fileId,
          name: file.name,
          arrayBuffer,
          pageCount,
          fileSize: arrayBuffer.byteLength,
          type: isImage ? 'image' : 'pdf',
        };
        allSourceFiles.push(sourceFile);

        const segmentPageIds: string[] = [];

        for (let i = 0; i < pageCount; i++) {
          const info = await getPageInfo(doc, i);
          const pageId = `${fileId}_p${i}`;
          allPages.push({
            id: pageId,
            sourceFileId: fileId,
            sourcePageIndex: i,
            rotation: 0,
            width: info.width,
            height: info.height,
            thumbnailUrl: null,
            redactions: [],
          });
          segmentPageIds.push(pageId);
        }

        const baseName = file.name.replace(/\.[^.]+$/, '');
        allSegments.push({
          id: crypto.randomUUID(),
          name: baseName,
          pageIds: segmentPageIds,
          color: getSegmentColor(allSegments.length),
          isCollapsed: false,
          evidenceNumber: null,
          groupId: null,
        });
      }

      dispatch({ type: 'FILES_LOADED', payload: { sourceFiles: allSourceFiles, pages: allPages, segments: allSegments } });
    } catch (error) {
      console.error('Failed to load files:', error);
      dispatch({ type: 'LOADING_FINISHED' });
    }
  }, [dispatch]);

  return { loadFiles };
}
