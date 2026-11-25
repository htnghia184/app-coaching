export function validReeActivityResponse(activityId: string, response: unknown): boolean {
  const count = activityId === 'ree-mcq' ? 6 : activityId === 'ree-matching' ? 4 : 0;
  if (!count || !response || typeof response !== 'object' || Array.isArray(response)) return false;
  const entries = response as Record<string, unknown>;
  if (Object.keys(entries).length !== count) return false;
  const explains = new Set<string>();
  const examples = new Set<string>();
  for (let index = 1; index <= count; index++) {
    const item = entries[String(index)];
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const answer = item as Record<string, unknown>;
    if (Object.keys(answer).length !== 2) return false;
    if (activityId === 'ree-mcq') {
      if (!['A','B','C'].includes(answer.choice as string) ||
          !['Explain','Example'].includes(answer.stage as string)) return false;
    } else {
      if (!['A','B','C','D'].includes(answer.explain as string) ||
          !['i','ii','iii','iv'].includes(answer.example as string)) return false;
      explains.add(answer.explain as string);
      examples.add(answer.example as string);
    }
  }
  return activityId === 'ree-mcq' || (explains.size === 4 && examples.size === 4);
}
