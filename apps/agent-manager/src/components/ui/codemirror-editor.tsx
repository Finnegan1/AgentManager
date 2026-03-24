import { useEffect, useRef, useCallback } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { syntaxHighlighting, defaultHighlightStyle, indentOnInput, bracketMatching, foldGutter, foldKeymap } from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { vim } from "@replit/codemirror-vim";
import { cn } from "@/lib/utils";

// Theme that uses the app's CSS custom properties directly
const editorTheme = EditorView.theme({
  "&": {
    backgroundColor: "var(--muted)",
    color: "var(--foreground)",
    fontSize: "13px",
    height: "100%",
  },
  ".cm-content": {
    fontFamily: "'JetBrains Mono Variable', monospace",
    padding: "8px 0",
    caretColor: "var(--foreground)",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--foreground)",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "var(--primary)",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "'JetBrains Mono Variable', monospace",
  },
  ".cm-gutters": {
    backgroundColor: "var(--secondary)",
    color: "var(--muted-foreground)",
    border: "none",
    borderRight: "1px solid var(--border)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--accent)",
    color: "var(--accent-foreground)",
  },
  ".cm-activeLine": {
    backgroundColor: "color-mix(in oklch, var(--accent) 40%, transparent)",
  },
  ".cm-selectionMatch": {
    backgroundColor: "color-mix(in oklch, var(--primary) 20%, transparent)",
  },
  "&.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in oklch, var(--primary) 30%, transparent) !important",
  },
  ".cm-searchMatch": {
    backgroundColor: "color-mix(in oklch, var(--primary) 25%, transparent)",
    outline: "1px solid var(--border)",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "color-mix(in oklch, var(--primary) 40%, transparent)",
  },
  ".cm-foldGutter": {
    color: "var(--muted-foreground)",
  },
  // Vim status bar / panels
  ".cm-panels": {
    backgroundColor: "var(--secondary)",
    color: "var(--foreground)",
    borderTop: "1px solid var(--border)",
  },
  ".cm-panels-bottom": {
    borderTop: "1px solid var(--border)",
  },
  ".cm-panel": {
    backgroundColor: "var(--secondary)",
    color: "var(--foreground)",
    padding: "2px 8px",
    fontFamily: "'JetBrains Mono Variable', monospace",
    fontSize: "12px",
  },
  ".cm-panel input": {
    backgroundColor: "var(--muted)",
    color: "var(--foreground)",
    border: "1px solid var(--border)",
    borderRadius: "3px",
    padding: "1px 4px",
  },
  ".cm-panel button": {
    backgroundColor: "var(--muted)",
    color: "var(--foreground)",
    border: "1px solid var(--border)",
    borderRadius: "3px",
    padding: "1px 6px",
  },
  // Vim fat cursor
  ".cm-fat-cursor": {
    background: "color-mix(in oklch, var(--primary) 60%, transparent) !important",
    color: "var(--primary-foreground) !important",
  },
  "&:not(.cm-focused) .cm-fat-cursor": {
    background: "none !important",
    outline: "1px solid color-mix(in oklch, var(--primary) 50%, transparent) !important",
    color: "transparent !important",
  },
  // Markdown syntax highlighting
  ".cm-header-1": { fontSize: "1.4em", fontWeight: "bold", color: "var(--primary)" },
  ".cm-header-2": { fontSize: "1.2em", fontWeight: "bold", color: "var(--primary)" },
  ".cm-header-3": { fontSize: "1.1em", fontWeight: "bold", color: "var(--primary)" },
  ".cm-meta": { color: "var(--muted-foreground)" },
  ".cm-link": { color: "var(--primary)", textDecoration: "underline" },
  ".cm-url": { color: "var(--muted-foreground)" },
  ".cm-strong": { fontWeight: "bold" },
  ".cm-em": { fontStyle: "italic" },
  ".cm-quote": { color: "var(--muted-foreground)", fontStyle: "italic" },
  ".cm-strikethrough": { textDecoration: "line-through", color: "var(--muted-foreground)" },
  // YAML frontmatter
  ".cm-atom": { color: "var(--primary)" },
  ".cm-string": { color: "var(--foreground)" },
  ".cm-keyword": { color: "var(--primary)" },
  ".cm-comment": { color: "var(--muted-foreground)", fontStyle: "italic" },
});

interface CodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function CodeMirrorEditor({ value, onChange, className }: CodeMirrorEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);

  // Keep the callback ref up to date
  onChangeRef.current = onChange;

  const createEditor = useCallback(() => {
    if (!containerRef.current) return;

    // Destroy existing editor
    if (viewRef.current) {
      viewRef.current.destroy();
    }

    const state = EditorState.create({
      doc: value,
      extensions: [
        vim(),
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        drawSelection(),
        rectangularSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        highlightSelectionMatches(),
        history(),
        foldGutter(),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        editorTheme,
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
          indentWithTab,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
  }, []); // Stable - only depends on refs

  // Initialize editor on mount
  useEffect(() => {
    createEditor();
    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [createEditor]);

  // Update content when value changes externally (not from typing)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentContent = view.state.doc.toString();
    if (currentContent !== value) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: value,
        },
      });
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "overflow-hidden rounded-md border border-border",
        className
      )}
    />
  );
}
