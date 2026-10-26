/**
 * Formulas for number answers, typed by teachers on T03, e.g. "= n × 4 × z".
 * Variables are single letters that match the {n}, {z} placeholders in the
 * question text. A small recursive-descent parser, so no eval().
 *
 * Grammar:
 *   expr   = term (("+" | "-") term)*
 *   term   = power (("*" | "×" | "/" | "÷" | ":") power)*
 *   power  = unary ("^" power)?
 *   unary  = "-" unary | atom
 *   atom   = number | variable | "(" expr ")"
 */

export type ParamRange = { min: number; max: number; step?: number; unit?: string };
export type Params = Record<string, ParamRange>;
export type Values = Record<string, number>;

type Token =
  | { kind: "num"; value: number }
  | { kind: "var"; name: string }
  | { kind: "op"; op: string };

export class FormulaError extends Error {}

function tokenize(source: string): Token[] {
  const src = source.trim().replace(/^=/, "");
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
    } else if (/\d/.test(ch)) {
      const match = /^\d+([.,]\d+)?/.exec(src.slice(i))!;
      tokens.push({ kind: "num", value: Number(match[0].replace(",", ".")) });
      i += match[0].length;
    } else if (/[a-z]/i.test(ch)) {
      // Single-letter variables, so "4n" and "n z" both read naturally.
      tokens.push({ kind: "var", name: ch.toLowerCase() });
      i++;
    } else if (ch === "{") {
      const match = /^\{([a-z])\}/i.exec(src.slice(i));
      if (!match) throw new FormulaError(`Onverwacht teken "{" op plaats ${i + 1}`);
      tokens.push({ kind: "var", name: match[1].toLowerCase() });
      i += match[0].length;
    } else if ("+-*×/÷:^()".includes(ch)) {
      tokens.push({ kind: "op", op: ch });
      i++;
    } else {
      throw new FormulaError(`Onbekend teken "${ch}"`);
    }
  }
  return insertImplicitMultiplication(tokens);
}

/** "4n" → "4 × n", "2(n+1)" → "2 × (n+1)" */
function insertImplicitMultiplication(tokens: Token[]): Token[] {
  const out: Token[] = [];
  for (const token of tokens) {
    const prev = out[out.length - 1];
    const prevEndsValue =
      prev && (prev.kind !== "op" || prev.op === ")");
    const startsValue =
      token.kind !== "op" || token.op === "(";
    if (prevEndsValue && startsValue) out.push({ kind: "op", op: "*" });
    out.push(token);
  }
  return out;
}

function parse(tokens: Token[], values: Values): number {
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (...ops: string[]) => {
    const t = peek();
    return t?.kind === "op" && ops.includes(t.op);
  };

  function expr(): number {
    let left = term();
    while (isOp("+", "-")) {
      const op = (tokens[pos++] as { op: string }).op;
      const right = term();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  function term(): number {
    let left = power();
    while (isOp("*", "×", "/", "÷", ":")) {
      const op = (tokens[pos++] as { op: string }).op;
      const right = power();
      if (op === "*" || op === "×") left *= right;
      else {
        if (right === 0) throw new FormulaError("Delen door nul");
        left /= right;
      }
    }
    return left;
  }

  function power(): number {
    const base = unary();
    if (isOp("^")) {
      pos++;
      return base ** power();
    }
    return base;
  }

  function unary(): number {
    if (isOp("-")) {
      pos++;
      return -unary();
    }
    return atom();
  }

  function atom(): number {
    const t = tokens[pos++];
    if (!t) throw new FormulaError("De formule is onvolledig");
    if (t.kind === "num") return t.value;
    if (t.kind === "var") {
      if (!(t.name in values)) {
        throw new FormulaError(`Onbekende variabele "${t.name}"`);
      }
      return values[t.name];
    }
    if (t.op === "(") {
      const value = expr();
      if (!isOp(")")) throw new FormulaError("Haakje ontbreekt");
      pos++;
      return value;
    }
    throw new FormulaError(`Onverwacht "${t.op}"`);
  }

  const result = expr();
  if (pos < tokens.length) throw new FormulaError("De formule is onvolledig");
  return result;
}

/** Evaluates a formula. Throws FormulaError with a Dutch message. */
export function evaluate(formula: string, values: Values = {}): number {
  const tokens = tokenize(formula);
  if (tokens.length === 0) throw new FormulaError("De formule is leeg");
  const result = parse(tokens, values);
  if (!Number.isFinite(result)) throw new FormulaError("Geen geldig getal");
  return result;
}

/** Variables used in a formula, e.g. "n × 4 × z" → ["n", "z"]. */
export function variablesIn(formula: string): string[] {
  try {
    const names = tokenize(formula)
      .filter((t): t is { kind: "var"; name: string } => t.kind === "var")
      .map((t) => t.name);
    return [...new Set(names)];
  } catch {
    return [];
  }
}

/** Placeholders in a question text, e.g. "{n} keer ... {z} m" → ["n", "z"]. */
export function placeholdersIn(body: string): string[] {
  return [...new Set([...body.matchAll(/\{([a-z])\}/gi)].map((m) => m[1].toLowerCase()))];
}

/** Fills the placeholders with this team's numbers. */
export function renderBody(body: string, values: Values): string {
  return body.replace(/\{([a-z])\}/gi, (whole, name: string) => {
    const value = values[name.toLowerCase()];
    return value === undefined
      ? whole
      : value.toLocaleString("nl-BE", { useGrouping: false, maximumFractionDigits: 2 });
  });
}

/** Picks random numbers for each placeholder. `random` is injectable for tests. */
export function pickValues(params: Params, random: () => number = Math.random): Values {
  const values: Values = {};
  for (const [name, range] of Object.entries(params)) {
    const step = range.step && range.step > 0 ? range.step : 1;
    const count = Math.floor((range.max - range.min) / step) + 1;
    const index = Math.floor(random() * Math.max(count, 1));
    values[name] = Number((range.min + index * step).toFixed(6));
  }
  return values;
}

/** True when the student's number is within the tolerance of the expected one. */
export function isCorrect(given: number, expected: number, tolerance: number): boolean {
  return Math.abs(given - expected) <= tolerance + 1e-9;
}
