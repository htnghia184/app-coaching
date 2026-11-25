export async function persistRecording(
  pendingPath: string | null,
  upload: () => Promise<string>,
  saveMetadata: (path: string) => Promise<void>,
  rememberPath: (path: string) => void
): Promise<string> {
  const path = pendingPath ?? await upload();
  rememberPath(path);
  await saveMetadata(path);
  return path;
}
