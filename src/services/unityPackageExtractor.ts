import * as fflate from 'fflate';
import { ExtractedAsset } from '../types';

interface RawTarEntry {
  name: string;
  size: number;
  data: Uint8Array;
}

/**
 * Parses uncompressed POSIX ustar / GNU tar binary data into entries.
 */
function parseTar(buffer: Uint8Array): RawTarEntry[] {
  const entries: RawTarEntry[] = [];
  let offset = 0;
  const decoder = new TextDecoder('utf-8');

  while (offset + 512 <= buffer.length) {
    // Check for end of archive (two consecutive blocks of 512 zeros)
    let isZeroBlock = true;
    for (let i = 0; i < 512; i++) {
      if (buffer[offset + i] !== 0) {
        isZeroBlock = false;
        break;
      }
    }
    if (isZeroBlock) {
      break;
    }

    // Name: bytes 0..100
    let nameRaw = decoder.decode(buffer.subarray(offset, offset + 100));
    const nullIdx = nameRaw.indexOf('\0');
    if (nullIdx !== -1) {
      nameRaw = nameRaw.substring(0, nullIdx);
    }
    const name = nameRaw.trim();

    // Size: bytes 124..136 (octal)
    const sizeRaw = decoder.decode(buffer.subarray(offset + 124, offset + 136));
    const sizeClean = sizeRaw.replace(/\0/g, '').trim();
    const size = parseInt(sizeClean, 8) || 0;

    // Typeflag: byte 156
    const typeflag = String.fromCharCode(buffer[offset + 156]);

    offset += 512;

    if (offset + size > buffer.length) {
      break;
    }

    // Regular file ('0', '\0', or '') and not PaxHeader
    const isPax = typeflag === 'x' || typeflag === 'g' || name.includes('PaxHeader');
    const isDir = typeflag === '5' || name.endsWith('/');

    if (!isPax && !isDir && (typeflag === '0' || typeflag === '\0' || typeflag === '')) {
      // Use buffer.slice() so each entry has its own standalone ArrayBuffer with byteOffset 0
      const data = buffer.slice(offset, offset + size);
      entries.push({ name, size, data });
    }

    // Advance to next 512-byte boundary
    offset += Math.ceil(size / 512) * 512;
  }

  return entries;
}

/**
 * Extracts a .unitypackage file (gzipped tar, raw tar, or zip)
 * and reconstructs the original Unity asset directory tree.
 */
export async function extractUnityPackage(
  fileBuffer: Uint8Array
): Promise<ExtractedAsset[]> {
  const decoder = new TextDecoder('utf-8');
  const extractedAssets: ExtractedAsset[] = [];

  // Check if it's a standard ZIP file (magic bytes 0x50, 0x4B)
  if (fileBuffer[0] === 0x50 && fileBuffer[1] === 0x4b) {
    try {
      const unzipped = fflate.unzipSync(fileBuffer);
      for (const [pathname, data] of Object.entries(unzipped)) {
        if (!data || data.length === 0 || pathname.endsWith('/')) continue;
        const filename = pathname.split('/').pop() || 'asset';
        const extension = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : '';
        const isAnimationCandidate = ['fbx', 'anim', 'bvh', 'glb', 'gltf'].includes(extension);

        extractedAssets.push({
          guid: `zip_${pathname.replace(/[^a-zA-Z0-9]/g, '_')}`,
          pathname,
          filename,
          extension,
          size: data.length,
          data,
          isAnimationCandidate,
        });
      }
      if (extractedAssets.length > 0) {
        return sortAssets(extractedAssets);
      }
    } catch {
      // Continue to tar extraction
    }
  }

  // Decompress GZIP if compressed (magic bytes 0x1F, 0x8B)
  let tarBytes: Uint8Array;
  if (fileBuffer[0] === 0x1f && fileBuffer[1] === 0x8b) {
    try {
      tarBytes = fflate.gunzipSync(fileBuffer);
    } catch {
      try {
        tarBytes = fflate.decompressSync(fileBuffer);
      } catch {
        tarBytes = fileBuffer;
      }
    }
  } else {
    tarBytes = fileBuffer;
  }

  const rawEntries = parseTar(tarBytes);

  interface GuidGroup {
    pathname?: string;
    asset?: Uint8Array;
    meta?: string;
    preview?: Uint8Array;
  }

  const guidMap = new Map<string, GuidGroup>();

  for (const entry of rawEntries) {
    const cleanPath = entry.name.replace(/^\.\//, '').replace(/^\\/, '');

    // Regex to match guid folder and file kind
    // e.g. <guid>/pathname, <guid>/asset, <guid>/asset.meta, <guid>/preview.png
    const match = cleanPath.match(/(?:^|\/)([a-f0-9]{32}|[a-zA-Z0-9_.-]{10,64})\/(pathname|asset\.meta|asset|preview(?:\.png)?)$/i);

    if (match) {
      const guid = match[1];
      const fileKind = match[2].toLowerCase();

      if (!guidMap.has(guid)) {
        guidMap.set(guid, {});
      }
      const group = guidMap.get(guid)!;

      if (fileKind === 'pathname') {
        group.pathname = decoder.decode(entry.data).trim();
      } else if (fileKind === 'asset') {
        group.asset = entry.data;
      } else if (fileKind === 'asset.meta') {
        group.meta = decoder.decode(entry.data);
      } else if (fileKind.startsWith('preview')) {
        group.preview = entry.data;
      }
    } else {
      // Direct raw files inside tar (some packages aren't guid-indexed)
      const filename = cleanPath.split('/').pop() || 'asset';
      const ext = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : '';
      if (['fbx', 'anim', 'glb', 'gltf', 'png', 'jpg', 'mat'].includes(ext)) {
        extractedAssets.push({
          guid: `raw_${cleanPath.replace(/[^a-zA-Z0-9]/g, '_')}`,
          pathname: cleanPath,
          filename,
          extension: ext,
          size: entry.size,
          data: entry.data,
          isAnimationCandidate: ['fbx', 'anim', 'bvh', 'glb', 'gltf'].includes(ext),
        });
      }
    }
  }

  for (const [guid, group] of guidMap.entries()) {
    if (!group.asset) continue;

    const pathname = group.pathname || `Assets/Asset_${guid.substring(0, 8)}.bin`;
    const filename = pathname.split('/').pop() || 'asset';
    const extension = filename.includes('.')
      ? filename.split('.').pop()!.toLowerCase()
      : '';

    let previewUrl: string | undefined;
    if (group.preview && group.preview.length > 0) {
      try {
        const blob = new Blob([group.preview as unknown as BlobPart], { type: 'image/png' });
        previewUrl = URL.createObjectURL(blob);
      } catch {
        // ignore
      }
    }

    const isAnimationCandidate = [
      'fbx',
      'anim',
      'bvh',
      'glb',
      'gltf',
      'blend',
    ].includes(extension);

    extractedAssets.push({
      guid,
      pathname,
      filename,
      extension,
      size: group.asset.length,
      data: group.asset,
      isAnimationCandidate,
      metaContent: group.meta,
      previewUrl,
    });
  }

  return sortAssets(extractedAssets);
}

function sortAssets(assets: ExtractedAsset[]): ExtractedAsset[] {
  return assets.sort((a, b) => {
    if (a.isAnimationCandidate && !b.isAnimationCandidate) return -1;
    if (!a.isAnimationCandidate && b.isAnimationCandidate) return 1;
    return a.pathname.localeCompare(b.pathname);
  });
}
