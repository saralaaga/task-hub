import { EditorState, RangeSetBuilder, type Extension } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
  placeholder
} from "@codemirror/view";

export type NoteComposerToken =
  | { type: "checkbox"; from: number; to: number; checked: boolean }
  | { type: "tag"; from: number; to: number; text: string };

export type TaskHubNoteComposer = {
  readonly view: EditorView;
  destroy: () => void;
  focus: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
};

export type TaskHubNoteComposerOptions = {
  parent: HTMLElement;
  value?: string;
  placeholder?: string;
  className?: string;
  extensions?: Extension[];
  onChange?: (value: string) => void;
  onSubmit?: () => void;
};

type NoteComposerThemeSpec = Parameters<typeof EditorView.theme>[0];

const TASK_MARKER = /^(\s*[-*]\s+\[([ xX])\]\s*)/u;
const NOTE_TAG = /(^|\s)(#[\p{L}\p{N}_/-]+)/gu;
const NOTE_COMPOSER_MIN_HEIGHT = "100px";

export function noteComposerThemeSpec(): NoteComposerThemeSpec {
  return {
    "&": {
      backgroundColor: "var(--background-primary)",
      border: "1px solid var(--background-modifier-border)",
      borderRadius: "8px",
      boxSizing: "border-box",
      height: "auto",
      minHeight: NOTE_COMPOSER_MIN_HEIGHT,
      overflow: "hidden",
      width: "100%"
    },
    "&.cm-focused": {
      borderColor: "var(--interactive-accent)",
      boxShadow: "0 0 0 2px color-mix(in srgb, var(--interactive-accent) 20%, transparent)",
      outline: "none"
    },
    ".cm-scroller": {
      fontFamily: "var(--font-interface)",
      overflow: "hidden"
    },
    ".cm-content": {
      caretColor: "var(--text-normal)",
      fontFamily: "var(--font-interface)",
      fontSize: "var(--font-ui-medium)",
      lineHeight: "1.45",
      minHeight: NOTE_COMPOSER_MIN_HEIGHT,
      padding: "10px 12px"
    },
    ".cm-content:focus": {
      outline: "none"
    },
    ".cm-line": {
      outline: "none"
    },
    ".cm-placeholder": {
      color: "var(--text-faint)"
    }
  };
}

export function collectNoteComposerTokens(text: string): NoteComposerToken[] {
  const tokens: NoteComposerToken[] = [];
  let lineStart = 0;
  for (const line of text.split(/\n/u)) {
    const taskMatch = line.match(TASK_MARKER);
    if (taskMatch) {
      tokens.push({
        type: "checkbox",
        from: lineStart + (taskMatch[1] ? taskMatch[1].search(/[-*]/u) : 0),
        to: lineStart + taskMatch[1].length,
        checked: taskMatch[2].toLowerCase() === "x"
      });
    }
    NOTE_TAG.lastIndex = 0;
    for (const match of line.matchAll(NOTE_TAG)) {
      const start = match.index ?? 0;
      const prefix = match[1] ?? "";
      const tag = match[2] ?? "";
      const from = lineStart + start + prefix.length;
      tokens.push({ type: "tag", from, to: from + tag.length, text: tag });
    }
    lineStart += line.length + 1;
  }
  return tokens.sort((left, right) => left.from - right.from || left.to - right.to);
}

export function createTaskHubNoteComposer(options: TaskHubNoteComposerOptions): TaskHubNoteComposer {
  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) options.onChange?.(update.state.doc.toString());
  });
  const submitKeyHandler = EditorView.domEventHandlers({
    keydown: (event) => {
      if (event.isComposing) return false;
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        options.onSubmit?.();
        return true;
      }
      return false;
    }
  });
  const view = new EditorView({
    state: EditorState.create({
      doc: options.value ?? "",
      extensions: [
        noteComposerDecorations(),
        ...(options.extensions ?? []),
        updateListener,
        submitKeyHandler,
        placeholder(options.placeholder ?? ""),
        EditorView.lineWrapping,
        EditorView.theme(noteComposerThemeSpec())
      ]
    }),
    parent: options.parent
  });
  view.dom.addClass("task-hub-note-composer");
  if (options.className) view.dom.addClass(options.className);
  return {
    view,
    destroy: () => view.destroy(),
    focus: () => view.focus(),
    getValue: () => view.state.doc.toString(),
    setValue: (value) => {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    }
  };
}

function noteComposerDecorations() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildNoteComposerDecorations(view);
      }

      update(update: ViewUpdate): void {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildNoteComposerDecorations(update.view);
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations
    }
  );
}

function buildNoteComposerDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const token of collectNoteComposerTokens(view.state.doc.toString())) {
    if (token.type === "checkbox") {
      builder.add(
        token.from,
        token.to,
        Decoration.replace({
          widget: new NoteComposerCheckboxWidget(token.from, token.to, token.checked)
        })
      );
    } else {
      builder.add(token.from, token.to, Decoration.mark({ class: "task-hub-task-tag task-hub-note-composer-tag" }));
    }
  }
  return builder.finish();
}

class NoteComposerCheckboxWidget extends WidgetType {
  constructor(
    private readonly from: number,
    private readonly to: number,
    private readonly checked: boolean
  ) {
    super();
  }

  eq(other: NoteComposerCheckboxWidget): boolean {
    return this.from === other.from && this.to === other.to && this.checked === other.checked;
  }

  toDOM(view: EditorView): HTMLElement {
    const input = document.createElement("input");
    input.className = "task-hub-note-composer-checkbox";
    input.type = "checkbox";
    input.checked = this.checked;
    input.addEventListener("click", (event) => {
      event.preventDefault();
      const currentMarker = view.state.sliceDoc(this.from, this.to);
      const nextMarker = currentMarker.replace(/\[[ xX]\]/u, this.checked ? "[ ]" : "[x]");
      view.dispatch({ changes: { from: this.from, to: this.to, insert: nextMarker } });
    });
    return input;
  }

  ignoreEvent(): boolean {
    return false;
  }
}
