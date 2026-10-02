import type { Cell, DataSettings, Dataset, Field, Grid, NumberHint, Series } from './types';
import { cellToNumber, detectDecimalSeparator, type DecimalSep } from './numbers';

export const DEFAULT_DATA_SETTINGS: DataSettings = {
  sheetIndex: 0,
  orientation: 'columns',
  header: 'auto',
  categoryField: null,
  seriesFields: null,
  decimal: 'auto',
  aggregate: 'none',
  sort: 'none',
  sortField: -1,
  topN: 0,
  groupOthers: true,
  hiddenCategories: [],
};

export function transpose(grid: Grid): Grid {
  const width = Math.max(0, ...grid.map((r) => r.length));
  const out: Grid = [];
  for (let c = 0; c < width; c++) out.push(grid.map((r) => r[c] ?? null));
  return out;
}

/** Letra de coluna no estilo do Excel: 0 → A, 25 → Z, 26 → AA. */
export function columnLetter(index: number): string {
  let s = '';
  let n = index + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function isNumberCell(c: Cell, dec: DecimalSep): boolean {
  return cellToNumber(c, dec) !== null;
}

function nonEmpty(c: Cell): boolean {
  return c !== null && !(typeof c === 'string' && c.trim() === '');
}

/**
 * A primeira linha é cabeçalho quando ela tem texto onde o resto da coluna tem números,
 * ou quando é toda texto e as demais linhas trazem números.
 */
export function detectHeader(grid: Grid, dec: DecimalSep): boolean {
  if (grid.length < 2) return false;
  const [first, ...rest] = grid;
  let votes = 0;
  let against = 0;
  for (let c = 0; c < first.length; c++) {
    const head = first[c];
    const body = rest.map((r) => r[c]).filter(nonEmpty);
    if (body.length === 0) continue;
    const bodyNumeric = body.filter((v) => isNumberCell(v, dec)).length / body.length;
    if (!nonEmpty(head)) continue;
    const headNumeric = isNumberCell(head, dec);
    if (!headNumeric && bodyNumeric >= 0.6) votes++;
    else if (headNumeric && bodyNumeric >= 0.6) {
      // Anos no cabeçalho (2021, 2022…) sobre valores que não são anos: é cabeçalho.
      const year = (v: Cell) => {
        const n = cellToNumber(v, dec);
        return n !== null && Number.isInteger(n) && n >= 1800 && n <= 2200;
      };
      if (year(head) && !body.every(year)) votes++;
      else against++;
    }
  }
  if (votes > 0 && votes >= against) return true;
  if (votes === 0 && against === 0) {
    // Tudo texto: cabeçalho se a primeira linha não tem vazios e não se repete.
    const texts = first.filter(nonEmpty).map(String);
    return texts.length === first.length && new Set(texts).size === texts.length && rest.length > 0;
  }
  return false;
}

/** Uma coluna parece ser de anos (2019, 2020…) ou uma sequência de inteiros? */
function looksLikeLabelNumbers(values: (number | null)[]): boolean {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length === 0) return false;
  const allYears = nums.every((v) => Number.isInteger(v) && v >= 1800 && v <= 2200);
  if (allYears && new Set(nums).size === nums.length) return true;
  return false;
}

export interface Prepared {
  /** Tabela já orientada (campos = colunas) sem o cabeçalho. */
  body: Grid;
  fields: Field[];
  headerUsed: boolean;
  dec: DecimalSep;
}

/** Orienta a tabela e identifica os campos. Usado pelo gráfico e pela pré-visualização. */
export function prepare(grid: Grid, settings: DataSettings): Prepared {
  const strings: string[] = [];
  for (const r of grid) for (const c of r) if (typeof c === 'string') strings.push(c);
  const dec: DecimalSep = settings.decimal === 'auto' ? detectDecimalSeparator(strings) : settings.decimal;

  const oriented = settings.orientation === 'rows' ? transpose(grid) : grid.map((r) => r.slice());
  const width = Math.max(0, ...oriented.map((r) => r.length));
  const headerUsed = settings.header === 'auto' ? detectHeader(oriented, dec) : settings.header;
  const headerRow = headerUsed ? oriented[0] ?? [] : [];
  const body = headerUsed ? oriented.slice(1) : oriented;

  const fields: Field[] = [];
  for (let c = 0; c < width; c++) {
    const cells = body.map((r) => r[c] ?? null).filter(nonEmpty);
    const numericShare = cells.length ? cells.filter((v) => isNumberCell(v, dec)).length / cells.length : 0;
    const fallback = settings.orientation === 'rows' ? `Linha ${c + 1}` : `Coluna ${columnLetter(c)}`;
    const headCell = headerRow[c];
    const name = nonEmpty(headCell ?? null) ? String(headCell).trim() : fallback;
    fields.push({ index: c, name, numeric: cells.length > 0 && numericShare >= 0.6 });
  }
  // Nomes repetidos ganham sufixo para não colidirem nas séries.
  const seen = new Map<string, number>();
  for (const f of fields) {
    const k = seen.get(f.name) ?? 0;
    seen.set(f.name, k + 1);
    if (k > 0) f.name = `${f.name} (${k + 1})`;
  }
  return { body, fields, headerUsed, dec };
}

/** Campo de categoria automático: o primeiro campo de texto, ou uma coluna de anos. */
export function autoCategoryField(prep: Prepared): number {
  const text = prep.fields.find((f) => !f.numeric);
  if (text) return text.index;
  const first = prep.fields[0];
  if (!first) return -1;
  const values = prep.body.map((r) => cellToNumber(r[first.index] ?? null, prep.dec));
  if (looksLikeLabelNumbers(values) && prep.fields.length > 1) return first.index;
  // Cabeçalho vazio na primeira coluna (como o Excel faz) também indica rótulos.
  return -1;
}

function aggregate(values: (number | null)[], mode: DataSettings['aggregate']): number | null {
  const nums = values.filter((v): v is number => v !== null);
  if (mode === 'count') return values.length;
  if (nums.length === 0) return null;
  switch (mode) {
    case 'avg':
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    case 'min':
      return Math.min(...nums);
    case 'max':
      return Math.max(...nums);
    default:
      return nums.reduce((a, b) => a + b, 0);
  }
}

export const OTHERS_LABEL = 'Outros';

export function buildDataset(grid: Grid, settings: DataSettings, hint: NumberHint): Dataset {
  const prep = prepare(grid, settings);
  const { body, fields, dec } = prep;
  const notes: string[] = [];

  let categoryField = settings.categoryField ?? autoCategoryField(prep);
  if (categoryField >= fields.length) categoryField = autoCategoryField(prep);
  const numericFields = fields.filter((f) => f.numeric && f.index !== categoryField);
  // A cor de cada série é a posição dela entre os campos numéricos: ligar/desligar
  // uma série não muda a cor das outras.
  const slotOf = new Map(fields.filter((f) => f.numeric).map((f, i) => [f.index, i]));

  const chosen = (settings.seriesFields ?? numericFields.map((f) => f.index)).filter(
    (i) => i !== categoryField && i < fields.length,
  );

  let categories: string[] = body.map((r, i) => {
    if (categoryField < 0) return String(i + 1);
    const c = r[categoryField];
    return nonEmpty(c ?? null) ? String(c).trim() : '(vazio)';
  });
  let categoryValues: (number | null)[] = body.map((r, i) =>
    categoryField < 0 ? i + 1 : cellToNumber(r[categoryField] ?? null, dec),
  );
  let columns: (number | null)[][] = chosen.map((fi) => body.map((r) => cellToNumber(r[fi] ?? null, dec)));

  const allCategories = Array.from(new Set(categories));

  // Esconde categorias marcadas.
  if (settings.hiddenCategories.length) {
    const hidden = new Set(settings.hiddenCategories);
    const keep = categories.map((c) => !hidden.has(c));
    categories = categories.filter((_, i) => keep[i]);
    categoryValues = categoryValues.filter((_, i) => keep[i]);
    columns = columns.map((col) => col.filter((_, i) => keep[i]));
  }

  // Junta categorias repetidas (como uma tabela dinâmica).
  const hasDuplicates = new Set(categories).size !== categories.length;
  if (settings.aggregate !== 'none') {
    const order: string[] = [];
    const groups = new Map<string, number[]>();
    categories.forEach((c, i) => {
      if (!groups.has(c)) {
        groups.set(c, []);
        order.push(c);
      }
      groups.get(c)!.push(i);
    });
    columns = columns.map((col) => order.map((c) => aggregate(groups.get(c)!.map((i) => col[i]), settings.aggregate)));
    categoryValues = order.map((c) => categoryValues[groups.get(c)![0]]);
    categories = order;
  } else if (hasDuplicates && categoryField >= 0) {
    notes.push('Há categorias repetidas. Use "Agrupar repetidas" para somar ou tirar a média.');
  }

  // Posição estável de cada categoria (cores por categoria seguem a categoria).
  const slotIndex = new Map(allCategories.map((c, i) => [c, i]));
  let order = categories.map((_, i) => i);

  const sortKey = (i: number): number => {
    if (settings.sortField >= 0) {
      const s = chosen.indexOf(settings.sortField);
      if (s >= 0) return columns[s][i] ?? -Infinity;
    }
    return columns.reduce((acc, col) => acc + (col[i] ?? 0), 0);
  };

  if (settings.sort === 'asc') order.sort((a, b) => sortKey(a) - sortKey(b));
  else if (settings.sort === 'desc') order.sort((a, b) => sortKey(b) - sortKey(a));
  else if (settings.sort === 'alpha')
    order.sort((a, b) => categories[a].localeCompare(categories[b], 'pt-BR', { numeric: true }));

  let othersRow: (number | null)[] | null = null;
  if (settings.topN > 0 && order.length > settings.topN) {
    const ranked = order.slice().sort((a, b) => sortKey(b) - sortKey(a));
    const top = new Set(ranked.slice(0, settings.topN));
    const rest = order.filter((i) => !top.has(i));
    order = order.filter((i) => top.has(i));
    if (settings.groupOthers) {
      othersRow = columns.map((col) => {
        const vals = rest.map((i) => col[i]).filter((v): v is number => v !== null);
        return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
      });
    }
  }

  const finalCategories = order.map((i) => categories[i]);
  const finalCategoryValues = order.map((i) => categoryValues[i]);
  const finalSlots = order.map((i) => slotIndex.get(categories[i]) ?? i);
  const series: Series[] = chosen.map((fi, s) => ({
    name: fields[fi].name,
    field: fi,
    colorSlot: slotOf.get(fi) ?? s,
    values: order.map((i) => columns[s][i]),
  }));
  if (othersRow) {
    finalCategories.push(OTHERS_LABEL);
    finalCategoryValues.push(null);
    finalSlots.push(allCategories.length);
    series.forEach((s, k) => s.values.push(othersRow![k]));
  }

  if (series.length === 0) notes.push('Nenhuma coluna numérica foi encontrada para virar série.');

  return {
    fields,
    categoryField,
    categoryName: categoryField >= 0 ? fields[categoryField]?.name ?? '' : '',
    categories: finalCategories,
    categoryValues: finalCategoryValues,
    categorySlots: finalSlots,
    series,
    hint,
    headerUsed: prep.headerUsed,
    decimalUsed: dec,
    allCategories,
    notes,
  };
}
