import Tesseract from 'tesseract.js';

export async function extractTextFromImage(buffer: Buffer): Promise<string> {
  try {
    const { data } = await Tesseract.recognize(buffer, 'eng', {
      logger: () => {},
    });
    return data.text?.trim() || '';
  } catch (err: any) {
    console.error('OCR failed:', err?.message || err);
    throw new Error('Could not process this image. Try uploading a clearer image or a different format.');
  }
}