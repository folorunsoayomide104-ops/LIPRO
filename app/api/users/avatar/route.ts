import { NextResponse } from 'next/server';
import { writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { guard } from '@/lib/api-guard';

const ALLOWED_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request) {
  const { ok, user, response } = await guard();
  if (!ok || !user) return response!;

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });

  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Image too large. Max size is 5MB.' }, { status: 413 });
  if (!ALLOWED_EXT[file.type]) return NextResponse.json({ error: 'Unsupported image type. Use PNG, JPG, WEBP or GIF.' }, { status: 415 });

  const ext = ALLOWED_EXT[file.type];
  const filename = `${user.userId}-${Date.now()}${ext}`;
  const dir = path.join(process.cwd(), 'public', 'avatars');
  const filePath = path.join(dir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());

  const previous = await prisma.user.findUnique({ where: { id: user.userId }, select: { avatarUrl: true } });

  await writeFile(filePath, buffer);

  if (previous?.avatarUrl) {
    const match = previous.avatarUrl.match(/^\/avatars\/([A-Za-z0-9_.-]+)$/);
    if (match) {
      const oldPath = path.join(dir, match[1]);
      if (oldPath.startsWith(dir)) await unlink(oldPath).catch(() => {});
    }
  }

  await prisma.user.update({ where: { id: user.userId }, data: { avatarUrl: `/avatars/${filename}` } });

  return NextResponse.json({ avatarUrl: `/avatars/${filename}` });
}
