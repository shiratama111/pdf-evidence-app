/**
 * Gemini API client for PDF analysis.
 * Calls REST API directly from browser (no SDK).
 */
import type { AiSplitSuggestion } from '@/types/pdf';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{ text?: string }>;
    };
  }>;
  error?: { message: string };
}

export async function analyzeForSplit(
  apiKey: string,
  pageImages: { pageIndex: number; base64: string; mimeType: string }[],
  totalPages: number,
): Promise<AiSplitSuggestion> {
  const imageParts = pageImages.map((img) => ({
    inline_data: {
      mime_type: img.mimeType,
      data: img.base64,
    },
  }));

  const prompt = `あなたはPDF書類の分析エキスパートです。
以下は${totalPages}ページのPDFの各ページ画像です（全ページまたは先頭部分のサンプル）。

このPDFには複数の異なる書類が含まれている可能性があります。
書類の境界を判定し、各書類グループに適切なファイル名を提案してください。

以下のJSON形式で回答してください（JSON以外のテキストは含めないでください）:
{
  "segments": [
    {
      "suggestedName": "ファイル名（拡張子なし）",
      "pageRange": [開始ページインデックス, 終了ページインデックス],
      "documentType": "書類の種類（例: 訴状, 証拠説明書, 戸籍謄本 等）"
    }
  ]
}

ルール:
- pageRangeは0始まりのインデックスで、開始と終了の両端を含む
- 全ページを漏れなくカバーすること（ページの重複や欠落は不可）
- ファイル名は内容を端的に表す日本語名にする
- 日付があれば YYYYMMDD_ を接頭辞にする`;

  const body = {
    contents: [{
      parts: [
        { text: prompt },
        ...imageParts,
      ],
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048,
    },
  };

  const model = 'gemini-2.5-flash';
  const url = `${API_BASE}/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data: GeminiResponse = await response.json();

  if (data.error) {
    throw new Error(`Gemini API Error: ${data.error.message}`);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini API returned no text response');
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from Gemini response');
  }

  const parsed = JSON.parse(jsonMatch[0]) as AiSplitSuggestion;
  return parsed;
}

/** Convert canvas to base64 for API submission */
export function canvasToBase64(canvas: HTMLCanvasElement): { base64: string; mimeType: string } {
  const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
  const base64 = dataUrl.split(',')[1];
  return { base64, mimeType: 'image/jpeg' };
}
