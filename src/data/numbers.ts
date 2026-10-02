// Leitura de números do jeito que eles chegam do Excel em português (e em inglês).
// "1.234,56", "R$ 1.234,56", "12,5%", "(1.234)", "1,2E+05", "−3" etc.

export type DecimalSep = ',' | '.';
export type NumberKind = 'plain' | 'percent' | 'currency';

export interface ParsedNumber {
  value: number;
  kind: NumberKind;
}

const CURRENCY_RE = /^(R\$|US\$|U\$|\$|€|£|¥)\s*|\s*(R\$|US\$|€|£)$/;
const NUMERIC_BODY_RE = /^[+-]?(?:\d[\d.,]*)?\d(?:[eE][+-]?\d+)?$|^[+-]?[.,]\d+$/;

/** Remove espaços (inclusive os "finos" e não separáveis) usados como separador de milhar. */
function stripSpaces(s: string): string {
  return s.replace(/[\s   ]/g, '');
}

/**
 * Decide qual é o separador decimal olhando amostras de texto.
 * Só conta como voto o que não é ambíguo: "1,5" vota vírgula, "1.5" vota ponto,
 * "1.234,5" vota vírgula, "1,234.5" vota ponto. "1.234" sozinho não decide nada.
 * Sem votos, assume vírgula (padrão brasileiro).
 */
export function detectDecimalSeparator(samples: Iterable<string>): DecimalSep {
  let comma = 0;
  let dot = 0;
  for (const raw of samples) {
    const s = stripSpaces(raw.replace(CURRENCY_RE, '').replace(/%/g, ''));
    if (!/\d/.test(s)) continue;
    if (/\d\.\d{3}(\.\d{3})*,\d+$/.test(s)) comma += 2;
    else if (/\d,\d{3}(,\d{3})*\.\d+$/.test(s)) dot += 2;
    else if (/^[+-]?\d*,(\d{1,2}|\d{4,})$/.test(s)) comma += 1;
    else if (/^[+-]?\d*\.(\d{1,2}|\d{4,})$/.test(s)) dot += 1;
    else if (/\d,\d{3},\d{3}/.test(s)) dot += 1;
    else if (/\d\.\d{3}\.\d{3}/.test(s)) comma += 1;
  }
  return dot > comma ? '.' : ',';
}

/** Converte um texto em número. Retorna null se o texto não for um número. */
export function parseNumber(raw: string, dec: DecimalSep): ParsedNumber | null {
  let s = raw.trim();
  if (s === '') return null;
  let kind: NumberKind = 'plain';
  let negative = false;

  // Sinal de menos tipográfico e contabilidade "(1.234)".
  s = s.replace(/[−‒–]/g, '-');
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1).trim();
  } else if (s.endsWith('-') && s.length > 1) {
    negative = !negative;
    s = s.slice(0, -1).trim();
  } else if (s.startsWith('+')) {
    s = s.slice(1).trim();
  }

  if (CURRENCY_RE.test(s)) {
    kind = 'currency';
    s = s.replace(CURRENCY_RE, '');
    // "R$ -10" também aparece.
    if (s.startsWith('-')) {
      negative = !negative;
      s = s.slice(1);
    }
  }
  if (s.endsWith('%') || s.startsWith('%')) {
    kind = 'percent';
    s = s.replace(/%/g, '');
  }

  s = stripSpaces(s);
  if (!NUMERIC_BODY_RE.test(s)) return null;

  const thousands = dec === ',' ? '.' : ',';
  // Separador de milhar só é aceito em grupos de 3 dígitos.
  const [intPart, ...rest] = s.split(dec);
  if (rest.length > 1) return null;
  if (intPart.includes(thousands)) {
    const groups = intPart.split(thousands);
    if (groups[0] === '' || groups.slice(1).some((g) => !/^\d{3}$/.test(g))) return null;
  }
  const fracPart = rest[0];
  if (fracPart !== undefined && fracPart.includes(thousands)) return null;

  const normalized = intPart.split(thousands).join('') + (fracPart !== undefined ? '.' + fracPart : '');
  let value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  if (kind === 'percent') value /= 100;
  if (negative) value = -value;
  // Evita ruído de ponto flutuante como 0.07 / 100 = 0.0007000000000000001
  value = Number(value.toPrecision(15));
  return { value, kind };
}

/** Converte um valor de célula (já tipado ou texto) em número. */
export function cellToNumber(cell: unknown, dec: DecimalSep): number | null {
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null;
  if (typeof cell === 'string') return parseNumber(cell, dec)?.value ?? null;
  return null;
}
