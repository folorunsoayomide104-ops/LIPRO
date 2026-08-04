import Tesseract from 'tesseract.js';

export async function extractTextFromImage(buffer: Buffer): Promise<string> {
  const { data } = await Tesseract.recognize(buffer, 'eng', {});
  return data.text?.trim() || '';
}