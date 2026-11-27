import { supabase } from '../lib/supabaseClient';

export type ResolvedMedia = { kind: 'youtube' | 'audio'; url: string; expiresIn?: number };

/** Real assigned-task player only. Public structural previews never call this. */
export async function resolveAssignedModuleMedia(assetRef: string, taskId: string, moduleKey: string, contentVersion: number): Promise<ResolvedMedia> {
  if (!/^private:[a-z0-9-]+:[a-z0-9-]+$/.test(assetRef) || !taskId || !moduleKey || !Number.isInteger(contentVersion)) throw new Error('Invalid media request');
  const { data, error } = await supabase.functions.invoke('module-media-resolver', {
    body: { assetRef, taskId, moduleKey, contentVersion },
  });
  if (error || !data || (data.kind !== 'youtube' && data.kind !== 'audio') || typeof data.url !== 'string') {
    throw new Error('Media unavailable');
  }
  const url = new URL(data.url);
  if (url.protocol !== 'https:' || (data.kind === 'youtube' && url.hostname !== 'www.youtube-nocookie.com')) {
    throw new Error('Invalid media response');
  }
  return data as ResolvedMedia;
}
