export type MediaAsset = { kind: 'youtube'; videoId: string } | { kind: 'audio'; bucket: string; path: string };
export type MediaMap = Record<string, Record<string, Record<string, MediaAsset>>>;

export function allowedOrigin(origin: string | null, configured: string): string | null {
  const origins = configured.split(',').map(value => value.trim()).filter(Boolean);
  return origin && origins.includes(origin) ? origin : null;
}

export function manifestHasAsset(content: unknown, moduleId: string, version: number, assetRef: string, kind: MediaAsset['kind']): boolean {
  if (!content || typeof content !== 'object') return false;
  const manifest = content as { moduleId?: unknown; contentVersion?: unknown; stages?: unknown };
  if (manifest.moduleId !== moduleId || manifest.contentVersion !== version || !Array.isArray(manifest.stages)) return false;
  return manifest.stages.some(stage => stage && typeof stage === 'object' && Array.isArray(stage.activities)
    && stage.activities.some((activity: unknown) => {
      if (!activity || typeof activity !== 'object') return false;
      const candidate = activity as { type?: unknown; payload?: { assetRef?: unknown; kind?: unknown } };
      return candidate.type === 'media' && candidate.payload?.assetRef === assetRef && candidate.payload.kind === kind;
    }));
}

export function configuredAsset(map: MediaMap, moduleId: string, version: number, assetRef: string): MediaAsset | null {
  const asset = map[moduleId]?.[String(version)]?.[assetRef];
  if (!asset || !['youtube', 'audio'].includes(asset.kind)) return null;
  return asset;
}
