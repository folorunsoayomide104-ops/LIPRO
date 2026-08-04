export interface TextChunk {
  index: number;
  content: string;
}

export function chunkText(text: string, wordsPerChunk: number = 500, overlapWords: number = 50): TextChunk[] {
  const words = text.split(/\s+/);
  if (words.length === 0) return [];

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < words.length) {
    const end = Math.min(start + wordsPerChunk, words.length);
    const chunk = words.slice(start, end).join(' ');
    chunks.push({ index, content: chunk });
    index++;

    if (end >= words.length) break;
    start = end - overlapWords;
    if (start < 0) start = 0;
  }

  return chunks;
}