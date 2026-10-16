export type TokenType =
  | "word"
  | "quoted"
  | "string"
  | "number"
  | "param"
  | "operator"
  | "dot"
  | "comma"
  | "semicolon"
  | "open"
  | "close"
  | "lbracket"
  | "rbracket"
  | "comment"
  | "unknown"

export interface Token {
  type: TokenType
  /** Normalized value: unquoted/unescaped for quoted identifiers, raw source otherwise. */
  value: string
  /** Upper-cased value for `word` tokens, empty for everything else. */
  upper: string
  start: number
  end: number
  /** False for unterminated strings, quoted identifiers, block comments and every line comment. */
  closed: boolean
}

interface Rule {
  type: TokenType | null
  pattern: RegExp
  closed?: (match: RegExpExecArray) => boolean
  value?: (match: RegExpExecArray) => string
}

const PUNCTUATION: Record<string, TokenType> = {
  ".": "dot",
  ",": "comma",
  ";": "semicolon",
  "(": "open",
  ")": "close",
  "[": "lbracket",
  "]": "rbracket",
}

// Order matters: comments before operators, dollar strings before params.
const RULES: Rule[] = [
  { type: null, pattern: /\s+/y },
  { type: "comment", pattern: /--[^\n]*/y, closed: () => false },
  {
    type: "comment",
    pattern: /\/\*[\s\S]*?(\*\/|$)/y,
    closed: (m) => m[1] === "*/",
  },
  {
    type: "string",
    pattern: /\$([A-Za-z_]\w*)?\$[\s\S]*?(\$\1\$|$)/y,
    closed: (m) => m[2] !== "",
  },
  {
    type: "string",
    pattern: /[Ee]'(?:[^'\\]|\\[\s\S]|'')*(')?/y,
    closed: (m) => m[1] !== undefined,
  },
  {
    type: "string",
    pattern: /[BbXx]?'(?:[^']|'')*(')?/y,
    closed: (m) => m[1] !== undefined,
  },
  {
    type: "quoted",
    pattern: /"((?:[^"]|"")*)(")?/y,
    closed: (m) => m[2] !== undefined,
    value: (m) => m[1].replace(/""/g, '"'),
  },
  { type: "number", pattern: /(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y },
  { type: "param", pattern: /\$\d+/y },
  { type: "word", pattern: /[A-Za-z_\u0080-￿][\w$\u0080-￿]*/y },
  { type: null, pattern: /[.,;()[\]]/y },
  { type: "operator", pattern: /[+\-*/<>=~!@#%^&|`?:]+/y },
  { type: "unknown", pattern: /[\s\S]/y },
]

function matchAt(
  sql: string,
  pos: number,
): { rule: Rule; match: RegExpExecArray } {
  for (const rule of RULES) {
    rule.pattern.lastIndex = pos
    const match = rule.pattern.exec(sql)
    if (match) return { rule, match }
  }
  throw new Error("unreachable: the last rule matches any character")
}

function toToken(
  rule: Rule,
  match: RegExpExecArray,
  text: string,
  start: number,
): Token | null {
  const type = rule.type ?? PUNCTUATION[text]
  if (!type) return null

  const value = rule.value ? rule.value(match) : text
  return {
    type,
    value,
    upper: type === "word" ? value.toUpperCase() : "",
    start,
    end: start + text.length,
    closed: rule.closed ? rule.closed(match) : true,
  }
}

/** Tokenizes PostgreSQL source. Whitespace is dropped; comments are kept as tokens. */
export function tokenize(sql: string): Token[] {
  const tokens: Token[] = []
  let pos = 0

  while (pos < sql.length) {
    const { rule, match } = matchAt(sql, pos)
    // Operators like `-` must not swallow a following `--` comment
    const text = rule.type === "operator" ? cutAtComment(match[0]) : match[0]
    const token = toToken(rule, match, text, pos)
    if (token) tokens.push(token)
    pos += text.length
  }

  return tokens
}

function cutAtComment(op: string): string {
  const idx = [op.indexOf("--"), op.indexOf("/*")].filter((i) => i > 0)
  return idx.length ? op.slice(0, Math.min(...idx)) : op
}

export const isWord = (token: Token | undefined, ...keywords: string[]) =>
  token?.type === "word" &&
  (keywords.length === 0 || keywords.includes(token.upper))

export const isIdentifier = (token: Token | undefined) =>
  token?.type === "word" || token?.type === "quoted"
