import { beforeEach, describe, expect, it, vi } from "vitest"
import { ref } from "vue"
import { db, parseCursor } from "../sql/completion/fixtures"

const registered: { provider: any; disposed: boolean }[] = []

vi.mock("monaco-editor", () => {
  class Range {
    constructor(
      public startLineNumber: number,
      public startColumn: number,
      public endLineNumber: number,
      public endColumn: number,
    ) {}
  }
  return {
    Range,
    languages: {
      CompletionItemKind: {
        Field: 3,
        Class: 5,
        Interface: 7,
        Struct: 6,
        Module: 8,
        Variable: 4,
        Function: 1,
        Keyword: 17,
      },
      CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
      CompletionTriggerKind: {
        Invoke: 0,
        TriggerCharacter: 1,
        TriggerForIncompleteCompletions: 2,
      },
      registerCompletionItemProvider: (_language: string, provider: any) => {
        const entry = { provider, disposed: false }
        registered.push(entry)
        return { dispose: () => (entry.disposed = true) }
      },
    },
  }
})

const { provideCompletions, useSchemaCompletion } =
  await import("../../src/composables/useSchemaCompletion")

/** Minimal ITextModel: offsets <-> 1-based line/column positions. */
function fakeModel(text: string) {
  const lineStarts = [0, ...[...text.matchAll(/\n/g)].map((m) => m.index! + 1)]
  return {
    getValue: () => text,
    getOffsetAt: ({
      lineNumber,
      column,
    }: {
      lineNumber: number
      column: number
    }) => lineStarts[lineNumber - 1] + column - 1,
    getPositionAt: (offset: number) => {
      const line = lineStarts.filter((s) => s <= offset).length
      return { lineNumber: line, column: offset - lineStarts[line - 1] + 1 }
    },
  }
}

function run(
  input: string,
  context: { triggerKind: number; triggerCharacter?: string } = {
    triggerKind: 0,
  },
) {
  const { sql, offset } = parseCursor(input)
  const model = fakeModel(sql)
  const position = model.getPositionAt(offset)
  return provideCompletions(model as any, position as any, context as any, db)
    .suggestions as any[]
}

beforeEach(() => {
  registered.length = 0
})

describe("provideCompletions", () => {
  it("maps items to Monaco suggestions", () => {
    const total = run("SELECT | FROM orders o").find(
      (s) => s.label.label === "total",
    )
    expect(total).toMatchObject({
      label: { label: "total", detail: " numeric(10,2)", description: "o" },
      kind: 3,
      insertText: "total",
    })
  })

  it("inserts functions as snippets", () => {
    const count = run("SELECT | FROM orders").find(
      (s) => s.label.label === "count",
    )
    expect(count).toMatchObject({
      insertText: "count($0)",
      insertTextRules: 4,
      kind: 1,
    })
  })

  it("replaces the whole word under the cursor on a multi-line query", () => {
    const [first] = run("SELECT *\nFROM us|ers")
    expect(first.range.insert).toMatchObject({
      startLineNumber: 2,
      startColumn: 6,
      endLineNumber: 2,
      endColumn: 8,
    })
    expect(first.range.replace).toMatchObject({
      startLineNumber: 2,
      startColumn: 6,
      endLineNumber: 2,
      endColumn: 11,
    })
  })

  it("answers explicit invocations even when only keywords apply", () => {
    expect(run("SELECT * FROM users |").map((s) => s.label.label)).toContain(
      "WHERE",
    )
  })

  it("drops keyword-only lists opened by typing a space", () => {
    expect(
      run("SELECT * FROM users |", { triggerKind: 1, triggerCharacter: " " }),
    ).toEqual([])
  })

  it("keeps table lists opened by typing a space", () => {
    expect(
      run("SELECT * FROM |", { triggerKind: 1, triggerCharacter: " " }).length,
    ).toBeGreaterThan(0)
  })

  it("always answers a dot", () => {
    expect(
      run("SELECT o.| FROM orders o", { triggerKind: 1, triggerCharacter: "." })
        .length,
    ).toBe(5)
  })
})

describe("useSchemaCompletion", () => {
  it("only serves the model of its own editor and reads the latest schema", () => {
    const model = fakeModel("SELECT * FROM ")
    const schema = ref<typeof db | null>(null)
    useSchemaCompletion({ getModel: () => model } as any, schema)
    const { provider } = registered[0]
    const ask = (m: unknown) =>
      provider.provideCompletionItems(m, model.getPositionAt(14), {
        triggerKind: 0,
      }).suggestions

    expect(provider.triggerCharacters).toContain(".")
    expect(ask(model)).toEqual([])
    schema.value = db
    expect(ask(model).length).toBeGreaterThan(0)
    expect(ask(fakeModel("SELECT * FROM "))).toEqual([])
  })

  it("unregisters the provider on dispose", () => {
    const completion = useSchemaCompletion(
      { getModel: () => null } as any,
      ref(null),
    )
    completion.dispose()
    expect(registered[0].disposed).toBe(true)
  })
})
