import * as monaco from "monaco-editor"

export interface QuerySegment {
  start: number
  end: number
  text: string
}

/**
 * Attaches query-selection behavior to a Monaco editor instance.
 * Splits the editor text into individual queries (delimited by `;` or blank lines),
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

  function getSegments(): QuerySegment[] {
    const model = editor.getModel()
    if (!model) return []

    const fullText = model.getValue()
    const segments: QuerySegment[] = []
    const regex = /;|\n\s*\n/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(fullText)) !== null) {
      pushSegment(fullText, lastIndex, match.index, segments)
      lastIndex = match.index + match[0].length
    }

    pushSegment(fullText, lastIndex, fullText.length, segments)

    return segments
  }

  /** Adds a segment with offsets trimmed to actual content boundaries. */
  function pushSegment(
    fullText: string,
    rawStart: number,
    rawEnd: number,
    segments: QuerySegment[],
  ) {
    const slice = fullText.slice(rawStart, rawEnd)
    const trimmed = slice.trim()
    if (!trimmed) return

    const leadingWs = slice.length - slice.trimStart().length
    const trailingWs = slice.length - slice.trimEnd().length

    segments.push({
      start: rawStart + leadingWs,
      end: rawEnd - trailingWs,
      text: trimmed,
    })
  }

  function getSegmentAtCursor(): QuerySegment | null {
    const model = editor.getModel()
    if (!model) return null

    const position = editor.getPosition()
    if (!position) return null

    const cursorOffset = model.getOffsetAt(position)
    const segments = getSegments()

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
