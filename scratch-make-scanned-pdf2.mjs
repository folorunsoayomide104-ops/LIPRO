import { PDFDocument, rgb } from 'pdf-lib';
import fs from 'fs';

const doc = await PDFDocument.create();
const PAGES = 20;
for (let i = 0; i < PAGES; i++) {
  const page = doc.addPage([595, 842]);
  page.drawRectangle({ x: 40, y: 780, width: 500, height: 2, color: rgb(0.1, 0.1, 0.1) });
  page.drawRectangle({ x: 40, y: 40, width: 500, height: 2, color: rgb(0.1, 0.1, 0.1) });
}
const bytes = await doc.save();
fs.writeFileSync('scratch-scanned-20page.pdf', bytes);
console.log('Wrote', PAGES, 'page scanned-style PDF,', bytes.length, 'bytes');
