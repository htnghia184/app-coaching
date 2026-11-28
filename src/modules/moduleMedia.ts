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

/** Authenticated local-admin preview of an unpublished draft; no task assignment. */
export async function resolveDraftModuleMedia(assetRef: string, moduleKey: string, contentVersion: number): Promise<ResolvedMedia> {
  if (!import.meta.env.DEV || !/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(import.meta.env.VITE_SUPABASE_URL ?? '')) throw new Error('Local draft preview only');
  const { data, error } = await supabase.functions.invoke('module-media-resolver', { body: { assetRef, moduleKey, contentVersion, draftPreview: true } });
  if (error || !data || data.kind !== 'youtube' || typeof data.url !== 'string' || new URL(data.url).hostname !== 'www.youtube-nocookie.com') throw new Error('Draft media unavailable');
  return data as ResolvedMedia;
}
