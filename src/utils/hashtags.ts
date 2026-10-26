/**
 * Utilitas hashtag konten.
 *
 * Pengguna boleh mengetik "#tipsmarketing #konteninstagram", "tipsmarketing,
 * konteninstagram", atau campuran keduanya. Semua bentuk dinormalisasi menjadi
 * array unik yang selalu diawali tanda # agar konsisten saat disimpan maupun
 * ditampilkan.
 */

export function parseHashtags(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of text.split(/[\s,]+/)) {
    const cleaned = raw
      .trim()
      .replace(/^#+/, '')
      .replace(/[^\p{L}\p{N}_]/gu, '');
    if (!cleaned) continue;

    const tag = `#${cleaned}`;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(tag);
  }

  return result;
}
