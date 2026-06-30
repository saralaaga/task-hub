import type { TaskHubTagInputElement } from "./tagInputSuggest";

export type TagChipEditor = {
  input: HTMLInputElement;
  getTags: () => string[];
};

export function createTagChipEditor(
  container: HTMLElement,
  options: {
    label: string;
    placeholder: string;
    initialTags: string[];
    allowedTags?: readonly string[];
    bindTagInputSuggest?: (input: TaskHubTagInputElement) => void;
    onChange?: () => void;
  }
): TagChipEditor {
  const editor = container.createDiv({ cls: "task-hub-tag-editor" });
  editor.setAttr("role", "textbox");
  editor.setAttr("aria-label", options.label);
  const tags = splitTaskTags(options.initialTags.join(" "));
  const allowedTags = options.allowedTags ? new Set(options.allowedTags.map(normalizeTaskTag).filter(Boolean)) : undefined;
  let selectedIndex = -1;
  let composing = false;

  const input = editor.createEl("input", {
    cls: "task-hub-tag-editor-input",
    type: "text",
    value: ""
  }) as HTMLInputElement;
  input.setAttr("aria-label", options.label);
  editor.addEventListener("click", (event) => {
    const target = event.target as { classList?: { contains(cls: string): boolean } } | null;
    if (event.target !== input && target?.classList?.contains("task-hub-tag-editor-chip")) return;
    selectedIndex = -1;
    render({ focusInput: true });
  });

  const render = (renderOptions: { focusInput?: boolean; focusSelectedChip?: boolean } = {}) => {
    let selectedChip: HTMLElement | undefined;
    for (const child of Array.from(editor.children)) {
      if (child !== input) child.remove();
    }
    editor.toggleClass("is-empty", tags.length === 0);
    if (tags.length === 0) {
      const empty = editor.createSpan({ cls: "task-hub-tag-editor-placeholder", text: options.placeholder });
      empty.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        input.focus();
      });
    }
    for (const [index, tag] of tags.entries()) {
      const chip = editor.createSpan({ cls: "task-hub-tag-editor-chip task-hub-task-tag", text: tag });
      chip.toggleClass("is-selected", index === selectedIndex);
      chip.setAttr("tabindex", index === selectedIndex ? "0" : "-1");
      if (index === selectedIndex) selectedChip = chip;
      chip.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectedIndex = index;
        render({ focusSelectedChip: true });
      });
    }
    editor.appendChild(input);
    if (renderOptions.focusSelectedChip && selectedChip) selectedChip.focus();
    else if (renderOptions.focusInput) input.focus();
  };

  const commit = () => {
    if (composing) return;
    const rawTags = splitTaskTags(input.value);
    const nextTags = rawTags.filter((tag) => !allowedTags || allowedTags.has(tag));
    if (nextTags.length === 0) {
      if (allowedTags && rawTags.length > 0) input.value = "";
      return;
    }
    let changed = false;
    for (const tag of nextTags) {
      if (!tags.includes(tag)) {
        tags.push(tag);
        changed = true;
      }
    }
    input.value = "";
    selectedIndex = -1;
    render({ focusInput: true });
    if (changed) options.onChange?.();
  };

  const removeSelectedTag = () => {
    if (selectedIndex < 0 || selectedIndex >= tags.length) return false;
    tags.splice(selectedIndex, 1);
    selectedIndex = tags.length === 0 ? -1 : Math.min(selectedIndex, tags.length - 1);
    render(selectedIndex === -1 ? { focusInput: true } : { focusSelectedChip: true });
    options.onChange?.();
    return true;
  };

  const inputCursorAtStart = () => (input.selectionStart ?? 0) === 0 && (input.selectionEnd ?? 0) === 0;
  const targetIsInput = (target: EventTarget | null) => target === input;

  editor.addEventListener("keydown", (event) => {
    if (event.isComposing || composing) return;
    if ((event.key === "Backspace" || event.key === "Delete") && selectedIndex !== -1) {
      event.preventDefault();
      removeSelectedTag();
      return;
    }
    if (event.key === "ArrowLeft" && (!targetIsInput(event.target) || inputCursorAtStart()) && tags.length > 0) {
      event.preventDefault();
      selectedIndex = selectedIndex === -1 ? tags.length - 1 : Math.max(0, selectedIndex - 1);
      render({ focusSelectedChip: true });
      return;
    }
    if (event.key === "ArrowRight" && selectedIndex !== -1) {
      event.preventDefault();
      selectedIndex = selectedIndex >= tags.length - 1 ? -1 : selectedIndex + 1;
      render(selectedIndex === -1 ? { focusInput: true } : { focusSelectedChip: true });
      return;
    }
    if (targetIsInput(event.target) && (event.key === "Backspace" || event.key === "Delete") && input.value === "" && tags.length > 0) {
      event.preventDefault();
      selectedIndex = tags.length - 1;
      removeSelectedTag();
      return;
    }
    if (!targetIsInput(event.target)) return;
    selectedIndex = -1;
    if (event.key === "Enter" && allowedTags) return;
    if (event.key !== "Enter" && event.key !== " " && event.key !== ",") return;
    event.preventDefault();
    commit();
  }, { capture: true });
  input.addEventListener("blur", commit);
  input.addEventListener("input", (event) => {
    if ((event as InputEvent).isComposing || composing) return;
    selectedIndex = -1;
    if (/\s$/u.test(input.value)) commit();
  });
  input.addEventListener("compositionstart", () => {
    composing = true;
  });
  input.addEventListener("compositionend", () => {
    composing = false;
    if (/\s$/u.test(input.value)) commit();
  });
  input.addEventListener("task-hub-tag-selected", commit);
  options.bindTagInputSuggest?.(input);
  render();

  return {
    input,
    getTags: () => {
      commit();
      return [...tags];
    }
  };
}

export function splitTaskTags(value: string): string[] {
  return Array.from(new Set(value.split(/\s+/).map(normalizeTaskTag).filter(Boolean)));
}

function normalizeTaskTag(tag: string): string {
  const normalized = tag.trim().replace(/^#+/u, "");
  return normalized ? `#${normalized}` : "";
}
