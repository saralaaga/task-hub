export type TaskNoteMarkdownRenderer = (container: HTMLElement, body: string, sourcePath: string) => void;

const NOTE_TAG = /(^|\s)(#[\p{L}\p{N}_/-]+)/gu;
const SKIP_TAG_DECORATION = new Set(["A", "BUTTON", "CODE", "INPUT", "PRE", "SCRIPT", "STYLE", "TEXTAREA"]);

export function renderTaskNoteBody(
  container: HTMLElement,
  body: string,
  sourcePath: string,
  renderMarkdown?: TaskNoteMarkdownRenderer
): void {
  if (renderMarkdown) {
    renderMarkdown(container, body, sourcePath);
    return;
  }
  renderPlainTaskNoteBody(container, body);
}

export function renderPlainTaskNoteBody(container: HTMLElement, body: string): void {
  let cursor = 0;
  for (const match of body.matchAll(NOTE_TAG)) {
    const start = match.index ?? 0;
    const prefix = match[1] ?? "";
    const tag = match[2] ?? "";
    const tagStart = start + prefix.length;
    appendNoteText(container, body.slice(cursor, tagStart));
    container.createSpan({ cls: "task-hub-task-tag", text: tag });
    cursor = tagStart + tag.length;
  }
  appendNoteText(container, body.slice(cursor));
}

export function taskNotePreviewTitle(sourcePath: string): string {
  return sourcePath.split("/").pop()?.replace(/\.md$/iu, "") ?? sourcePath;
}

export function taskNotePreviewBody(body: string): string {
  return body.trim();
}

export function decorateRenderedTaskNoteTags(container: HTMLElement): void {
  for (const tagElement of Array.from(container.querySelectorAll(".tag"))) {
    if (tagElement.textContent?.startsWith("#")) tagElement.classList.add("task-hub-task-tag");
  }
  const ownerDocument = container.doc;
  const walker = ownerDocument.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    if (current.instanceOf(Text) && current.nodeValue && shouldDecorateTextNode(current)) {
      textNodes.push(current);
    }
    current = walker.nextNode();
  }
  for (const node of textNodes) {
    replaceTextNodeTags(node);
  }
}

function appendNoteText(container: HTMLElement, text: string): void {
  if (!text) return;
  container.createSpan({ cls: "task-hub-task-note-text", text });
}

function shouldDecorateTextNode(node: Text): boolean {
  let parent = node.parentElement;
  while (parent) {
    if (SKIP_TAG_DECORATION.has(parent.tagName)) return false;
    if (parent.classList.contains("task-hub-task-tag")) return false;
    parent = parent.parentElement;
  }
  NOTE_TAG.lastIndex = 0;
  return NOTE_TAG.test(node.nodeValue ?? "");
}

function replaceTextNodeTags(node: Text): void {
  const text = node.nodeValue ?? "";
  NOTE_TAG.lastIndex = 0;
  const ownerDocument = node.doc;
  const fragment = ownerDocument.createDocumentFragment();
  let cursor = 0;
  for (const match of text.matchAll(NOTE_TAG)) {
    const start = match.index ?? 0;
    const prefix = match[1] ?? "";
    const tag = match[2] ?? "";
    const tagStart = start + prefix.length;
    if (tagStart > cursor) fragment.append(ownerDocument.createTextNode(text.slice(cursor, tagStart)));
    const tagElement = ownerDocument.createElement("span");
    tagElement.className = "task-hub-task-tag";
    tagElement.textContent = tag;
    fragment.append(tagElement);
    cursor = tagStart + tag.length;
  }
  if (cursor < text.length) fragment.append(ownerDocument.createTextNode(text.slice(cursor)));
  node.replaceWith(fragment);
}
