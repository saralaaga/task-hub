const DIDA_TITLE_TAG = /(^|\s)(#[\p{L}\p{N}_/-]+)/gu;

export function normalizeDidaTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const tag of tags) {
    const body = tag.replace(/^#+/u, "").trim();
    if (!body) continue;
    const key = body.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(body);
  }
  return normalized;
}

export function didaTagsForTaskHub(tags: string[]): string[] {
  return normalizeDidaTags(tags).map((tag) => `#${tag}`);
}

export function extractDidaTitleTags(title: string): { title: string; tags: string[] } {
  const tags = Array.from(title.matchAll(DIDA_TITLE_TAG), (match) => match[2]);
  return {
    title: title.replace(DIDA_TITLE_TAG, " ").replace(/\s+/gu, " ").trim(),
    tags: normalizeDidaTags(tags)
  };
}
