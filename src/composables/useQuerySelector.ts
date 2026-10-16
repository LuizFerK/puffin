import * as monaco from "monaco-editor"
import { splitStatements } from "../sql/completion/statement"

export interface QuerySegment {
  start: number
  end: number
  text: string
}

/**
 * Attaches query-selection behavior to a Monaco editor instance.
 * Splits the editor text into individual queries (delimited by `;` or blank lines
 * outside strings and comments, the same split autocomplete uses),
 * highlights the active segment with decorations, and provides `getQueryAtCursor()`
 * to retrieve the query text under the cursor.
 *
 * Call `dispose()` when tearing down the editor.
 */
export function useQuerySelector(editor: monaco.editor.IStandaloneCodeEditor) {
  const decorationCollection = editor.createDecorationsCollection()
  let highlightTimer: ReturnType<typeof setTimeout> | null = null

  // ── Listeners ───────────────────────────────────────────────────────

  const cursorDisposable = editor.onDidChangeCursorPosition(() => {
    debouncedHighlight()
  })

  const contentDisposable = editor.onDidChangeModelContent(() => {
    debouncedHighlight()
  })

  // Initial highlight
  highlightActiveQuery()

  // ── Segment parsing ─────────────────────────────────────────────────

  /** Statements around the cursor, trimmed to their first and last token. */
  function getSegments(cursorOffset: number): QuerySegment[] {
    const model = editor.getModel()
    if (!model) return []

    const fullText = model.getValue()
    return splitStatements(fullText, cursorOffset)
      .filter((s) => s.tokens.length > 0)
      .map(({ tokens }) => {
        const start = tokens[0].start
        const end = tokens[tokens.length - 1].end
        return { start, end, text: fullText.slice(start, end) }
      })
  }

  function getSegmentAtCursor(): QuerySegment | null {
    const model = editor.getModel()
    if (!model) return null

    const position = editor.getPosition()
    if (!position) return null

    const cursorOffset = model.getOffsetAt(position)
    const segments = getSegments(cursorOffset)

    if (segments.length === 0) {
      const fullText = model.getValue()
      return fullText
        ? { start: 0, end: fullText.length, text: fullText }
        : null
    }

    // Exact match
    for (const seg of segments) {
      if (cursorOffset >= seg.start && cursorOffset <= seg.end) {
        return seg
      }
    }

    // Nearest fallback
    let nearest = segments[0]
    let minDist = Infinity
    for (const seg of segments) {
      const dist = Math.min(
        Math.abs(cursorOffset - seg.start),
        Math.abs(cursorOffset - seg.end),
      )
      if (dist < minDist) {
        minDist = dist
        nearest = seg
      }
    }
    return nearest
  }

  function getQueryAtCursor(): string | null {
    return getSegmentAtCursor()?.text ?? null
  }

  // ── Active query highlight ──────────────────────────────────────────

  function debouncedHighlight() {
    if (highlightTimer) clearTimeout(highlightTimer)
    highlightTimer = setTimeout(highlightActiveQuery, 150)
  }

  function highlightActiveQuery() {
    const model = editor.getModel()
    if (!model) return

    const segment = getSegmentAtCursor()
    if (!segment) {
      decorationCollection.clear()
      return
    }

    const startPos = model.getPositionAt(segment.start)
    const endPos = model.getPositionAt(segment.end)

    decorationCollection.set([
      {
        range: new monaco.Range(
          startPos.lineNumber,
          1,
          endPos.lineNumber,
          model.getLineMaxColumn(endPos.lineNumber),
        ),
        options: {
          isWholeLine: true,
          className: "active-query-highlight",
          linesDecorationsClassName: "active-query-gutter",
        },
      },
    ])
  }

  // ── Cleanup ─────────────────────────────────────────────────────────

  function dispose() {
    if (highlightTimer) clearTimeout(highlightTimer)
    cursorDisposable.dispose()
    contentDisposable.dispose()
    decorationCollection.clear()
  }

  return { getQueryAtCursor, getSegmentAtCursor, dispose }
}
