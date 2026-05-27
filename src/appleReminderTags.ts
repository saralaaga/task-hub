export function appleReminderTitleWithTags(title: string, tags: string[], enabled: boolean): string {
  const cleanTitle = title.replace(/\s+/g, " ").trim();
  if (!enabled) return cleanTitle;
  const appleTags = normalizeAppleReminderTags(tags);
  if (appleTags.length === 0) return cleanTitle;
  return `${cleanTitle} ${appleTags.join(" ")}`.trim();
}

export function normalizeAppleReminderTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const tag of tags) {
    const body = tag
      .replace(/^#+/, "")
      .replace(/\//g, "-")
      .replace(/[^\p{L}\p{N}_-]+/gu, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    if (!body) continue;
    const appleTag = `#${body}`;
    const key = appleTag.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(appleTag);
  }
  return normalized;
}

const APPLE_REMINDER_TAG = /(^|\s)(#[\p{L}\p{N}_/-]+)/gu;

export function extractAppleReminderTitleTags(title: string): { title: string; tags: string[] } {
  const tags = Array.from(title.matchAll(APPLE_REMINDER_TAG), (match) => match[2]);
  return {
    title: title.replace(APPLE_REMINDER_TAG, " ").replace(/\s+/g, " ").trim(),
    tags: normalizeAppleReminderTags(tags)
  };
}

export function mergeAppleReminderTags(...tagGroups: string[][]): string[] {
  return normalizeAppleReminderTags(tagGroups.flat());
}
