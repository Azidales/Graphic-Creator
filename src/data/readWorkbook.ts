import { read, utils, type CellObject, type WorkSheet } from 'xlsx';
import type { Cell, NumberHint, Sheet, Workbook } from './types';
import { detectHint, parsePastedText, tidyGrid } from './parseText';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatDate(d: Date): string {
  const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  return hasTime ? `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/**
 * Formatos de mês como "mmm/yy" ou "mmmm yyyy" viram "jan/25" ou "janeiro 2025"
 * (o SheetJS escreveria os nomes em inglês).
 */
export function formatMonthDate(d: Date, z: string): string | null {
  const clean = z.replace(/\[[^\]]*\]/g, '').replace(/["\\]/g, '').replace(/;.*$/, '');
  if (!/m{3,}/i.test(clean) || /d|h|s/i.test(clean)) return null;
  return clean.replace(/y{4}|y{2}|m{3,}/gi, (tok) => {
    const t = tok.toLowerCase();
    if (t === 'yyyy') return String(d.getFullYear());
    if (t === 'yy') return String(d.getFullYear()).slice(-2);
    const name = MONTHS[d.getMonth()];
    return t.length >= 4 ? name : name.slice(0, 3);
  });
}

function sheetToGrid(ws: WorkSheet): { grid: Cell[][]; hint: NumberHint } {
  const ref = ws['!ref'];
  if (!ref) return { grid: [], hint: null };
  const range = utils.decode_range(ref);
  const grid: Cell[][] = [];
  let numbers = 0;
  let percent = 0;
  let currency = 0;
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: Cell[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[utils.encode_cell({ r, c })] as CellObject | undefined;
      if (!cell || cell.v === undefined || cell.v === null || cell.t === 'z') {
        row.push(null);
        continue;
      }
      if (cell.t === 'n') {
        const z = typeof cell.z === 'string' ? cell.z : '';
        numbers++;
        if (z.includes('%')) percent++;
        else if (/R\$|\$|€|£/.test(z)) currency++;
        row.push(cell.v as number);
      } else if (cell.t === 'd' && cell.v instanceof Date) {
        const z = typeof cell.z === 'string' ? cell.z : '';
        row.push(formatMonthDate(cell.v, z) ?? formatDate(cell.v));
      } else if (cell.t === 'b') {
        row.push(cell.v ? 'VERDADEIRO' : 'FALSO');
      } else if (cell.t === 'e') {
        row.push(null);
      } else {
        row.push(String(cell.w ?? cell.v));
      }
    }
    grid.push(row);
  }
  let hint: NumberHint = null;
  if (numbers > 0 && percent / numbers > 0.5) hint = 'percent';
  else if (numbers > 0 && currency / numbers > 0.5) hint = 'currency';
  return { grid: tidyGrid(grid), hint };
}

/** Lê .xlsx, .xls, .ods, .csv ou .tsv. */
export async function readFile(file: File): Promise<Workbook> {
  const name = file.name;
  if (/\.(csv|tsv|txt)$/i.test(name)) {
    const text = await file.text();
    const grid = parsePastedText(text);
    return { source: name, sheets: [{ name: name.replace(/\.[^.]+$/, ''), grid, hint: detectHint(grid) }] };
  }
  const buffer = await file.arrayBuffer();
  const wb = read(buffer, { type: 'array', cellDates: true, cellNF: true, dense: false });
  const sheets: Sheet[] = wb.SheetNames.map((sheetName) => {
    const { grid, hint } = sheetToGrid(wb.Sheets[sheetName]);
    return { name: sheetName, grid, hint };
  }).filter((s) => s.grid.length > 0);
  if (sheets.length === 0) throw new Error('A planilha está vazia.');
  return { source: name, sheets };
}
