import JSZip from 'jszip';
import { saveAs } from 'file-saver';

/** Sanitize filename for Windows compatibility */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim() || 'untitled';
}

/** Download a single PDF file */
export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  saveAs(blob, `${sanitizeFilename(filename)}.pdf`);
}

/** Download multiple PDFs as a ZIP file */
export async function downloadAsZip(
  files: Map<string, { name: string; bytes: Uint8Array }>,
  zipName = 'split_pdfs',
) {
  const zip = new JSZip();
  const nameCount = new Map<string, number>();

  for (const { name, bytes } of files.values()) {
    let safeName = sanitizeFilename(name);
    const count = nameCount.get(safeName) ?? 0;
    if (count > 0) safeName = `${safeName}_${count}`;
    nameCount.set(safeName, count + 1);
    zip.file(`${safeName}.pdf`, bytes);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `${sanitizeFilename(zipName)}.zip`);
}
