import type { Grid, NumberHint } from './types';
import { detectDecimalSeparator, parseNumber } from './numbers';

/** Escolhe o separador de colunas: tab (Excel/Sheets), ponto e vírgula (CSV brasileiro), vírgula ou espaços. */
export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '').slice(0, 50);
  if (lines.some((l) => l.includes('\t'))) return '\t';
  const consistent = (d: string) => {
    const counts = lines.map((l) => countOutsideQuotes(l, d));
    return counts[0] > 0 && counts.every((c) => c === counts[0]);
  };
  if (consistent(';')) return ';';
  if (consistent(',')) return ',';
  if (lines.some((l) => l.includes(';'))) return ';';
  if (lines.some((l) => /\S {2,}\S/.test(l))) return '  ';
  if (lines.some((l) => l.includes(','))) return ',';
  return '\t';
}

function countOutsideQuotes(line: string, d: string): number {
  let n = 0;
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (!q && ch === d) n++;
  }
  return n;
}

/**
 * Lê texto delimitado respeitando aspas (o Excel coloca entre aspas células com
 * quebra de linha ou aspas internas).
 */
export function parseDelimited(text: string, delimiter: string): string[][] {
  if (delimiter === '  ') {
    return text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l !== '')
      .map((l) => l.split(/\s{2,}/));
  }
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"' && cell.trim() === '') {
      inQuotes = true;
      cell = '';
      i++;
      continue;
    }
    if (ch === delimiter) {
      row.push(cell);
      cell = '';
      i++;
      continue;
    }
    if (ch === '\r' || ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      if (ch === '\r' && text[i + 1] === '\n') i++;
      i++;
      continue;
    }
    cell += ch;
    i++;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Remove linhas e colunas totalmente vazias e deixa a tabela retangular. */
export function tidyGrid(grid: Grid): Grid {
  const isEmpty = (c: unknown) => c === null || c === undefined || (typeof c === 'string' && c.trim() === '');
  const rows = grid.filter((r) => r.some((c) => !isEmpty(c)));
  const width = Math.max(0, ...rows.map((r) => r.length));
  const keepCols: number[] = [];
  for (let c = 0; c < width; c++) {
    if (rows.some((r) => !isEmpty(r[c]))) keepCols.push(c);
  }
  return rows.map((r) =>
    keepCols.map((c) => {
      const v = r[c];
      if (isEmpty(v)) return null;
      return typeof v === 'string' ? v.trim() : (v as number);
    }),
  );
}

/** Descobre se a maioria dos números colados é porcentagem ou moeda. */
export function detectHint(grid: Grid): NumberHint {
  const strings: string[] = [];
  for (const r of grid) for (const c of r) if (typeof c === 'string') strings.push(c);
  const dec = detectDecimalSeparator(strings);
  let percent = 0;
  let currency = 0;
  let numbers = 0;
  for (const s of strings) {
    const p = parseNumber(s, dec);
    if (!p) continue;
    numbers++;
    if (p.kind === 'percent') percent++;
    if (p.kind === 'currency') currency++;
  }
  if (numbers === 0) return null;
  if (percent / numbers > 0.5) return 'percent';
  if (currency / numbers > 0.5) return 'currency';
  return null;
}

export function parsePastedText(text: string): Grid {
  const clean = text.replace(/^﻿/, '');
  const delimiter = detectDelimiter(clean);
  return tidyGrid(parseDelimited(clean, delimiter));
}
