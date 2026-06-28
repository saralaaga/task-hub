import type { TaskItem, TaskNoteManualOrder, TaskNotePinned } from "./types";
import type { TaskNote } from "./taskNotes";
import type { TaskListDropPosition } from "./taskListOrdering";

export function taskNoteOrderScopeKey(task: TaskItem): string {
  return `task:${task.stableId ?? task.id}`;
}

export function taskNoteOrderItemKey(note: TaskNote): string {
  return note.noteId ?? note.path;
}

export function applyTaskNoteManualOrder(notes: TaskNote[], orderedNoteKeys: readonly string[]): TaskNote[] {
  if (notes.length <= 1 || orderedNoteKeys.length === 0) return [...notes];
  const indexByNoteKey = new Map(
    uniqueKeys(orderedNoteKeys).map((noteKey, index) => [noteKey, index])
  );
  const ranked = notes
    .filter((note) => indexByNoteKey.has(taskNoteOrderItemKey(note)))
    .sort((left, right) => (indexByNoteKey.get(taskNoteOrderItemKey(left)) ?? 0) - (indexByNoteKey.get(taskNoteOrderItemKey(right)) ?? 0));
  const unranked = notes.filter((note) => !indexByNoteKey.has(taskNoteOrderItemKey(note)));
  return [...ranked, ...unranked];
}

export function applyTaskNotePinned(notes: TaskNote[], pinnedNoteKeys: readonly string[]): TaskNote[] {
  if (notes.length <= 1 || pinnedNoteKeys.length === 0) return [...notes];
  const pinnedKeys = new Set(uniqueKeys(pinnedNoteKeys));
  const pinned = notes.filter((note) => pinnedKeys.has(taskNoteOrderItemKey(note)));
  const unpinned = notes.filter((note) => !pinnedKeys.has(taskNoteOrderItemKey(note)));
  return [...pinned, ...unpinned];
}

export function sortTaskNotes(
  notes: TaskNote[],
  orderedNoteKeys: readonly string[],
  pinnedNoteKeys: readonly string[]
): TaskNote[] {
  return applyTaskNotePinned(applyTaskNoteManualOrder(notes, orderedNoteKeys), pinnedNoteKeys);
}

export function reorderTaskNotes(
  notes: TaskNote[],
  manualOrder: TaskNoteManualOrder,
  task: TaskItem,
  draggedNote: TaskNote,
  anchorNote: TaskNote,
  position: TaskListDropPosition
): string[] {
  const scopeKey = taskNoteOrderScopeKey(task);
  const orderedKeys = applyTaskNoteManualOrder(notes, manualOrder[scopeKey] ?? []).map(taskNoteOrderItemKey);
  const draggedKey = taskNoteOrderItemKey(draggedNote);
  const anchorKey = taskNoteOrderItemKey(anchorNote);
  if (draggedKey === anchorKey) return orderedKeys;

  const next = orderedKeys.filter((noteKey) => noteKey !== draggedKey);
  const anchorIndex = next.indexOf(anchorKey);
  if (anchorIndex === -1) return orderedKeys;
  const insertIndex = position === "before" ? anchorIndex : anchorIndex + 1;
  next.splice(insertIndex, 0, draggedKey);
  return next;
}

export function cleanupTaskNoteManualOrderEntry(notes: TaskNote[], orderedNoteKeys: readonly string[]): string[] {
  if (notes.length <= 1 || orderedNoteKeys.length === 0) return [];
  const noteKeys = new Set(notes.map(taskNoteOrderItemKey));
  const validOrderedKeys = uniqueKeys(orderedNoteKeys).filter((noteKey) => noteKeys.has(noteKey));
  if (validOrderedKeys.length === 0) return [];
  const defaultOrder = notes.map(taskNoteOrderItemKey);
  const appliedOrder = applyTaskNoteManualOrder(notes, validOrderedKeys).map(taskNoteOrderItemKey);
  return arraysEqual(defaultOrder, appliedOrder) ? [] : validOrderedKeys;
}

export function cleanupTaskNotePinnedEntry(notes: TaskNote[], pinnedNoteKeys: readonly string[]): string[] {
  if (notes.length === 0 || pinnedNoteKeys.length === 0) return [];
  const noteKeys = new Set(notes.map(taskNoteOrderItemKey));
  return uniqueKeys(pinnedNoteKeys).filter((noteKey) => noteKeys.has(noteKey));
}

export function togglePinnedTaskNote(
  pinned: TaskNotePinned,
  task: TaskItem,
  note: TaskNote
): string[] {
  const scopeKey = taskNoteOrderScopeKey(task);
  const noteKey = taskNoteOrderItemKey(note);
  const current = pinned[scopeKey] ?? [];
  return current.includes(noteKey) ? current.filter((key) => key !== noteKey) : [noteKey, ...current];
}

export function prioritizeTaskNoteInManualOrder(
  notes: TaskNote[],
  manualOrder: TaskNoteManualOrder,
  task: TaskItem,
  note: TaskNote
): string[] {
  const scopeKey = taskNoteOrderScopeKey(task);
  const noteKey = taskNoteOrderItemKey(note);
  const currentOrder = applyTaskNoteManualOrder(notes, manualOrder[scopeKey] ?? []).map(taskNoteOrderItemKey);
  return [noteKey, ...currentOrder.filter((key) => key !== noteKey)];
}

function uniqueKeys(keys: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const key of keys) {
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(key);
  }
  return result;
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}
