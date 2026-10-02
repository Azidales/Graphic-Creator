import { describe, expect, it } from 'vitest';
import { detectDecimalSeparator, parseNumber } from './numbers';
import { detectDelimiter, detectHint, parseDelimited, parsePastedText } from './parseText';
import { buildDataset, columnLetter, DEFAULT_DATA_SETTINGS, detectHeader, transpose } from './dataset';
import { SAMPLES } from './samples';
import { formatDate, formatMonthDate } from './readWorkbook';
import type { DataSettings } from './types';

const settings = (patch: Partial<DataSettings> = {}): DataSettings => ({ ...DEFAULT_DATA_SETTINGS, ...patch });

describe('parseNumber', () => {
  it('lê números no formato brasileiro', () => {
    expect(parseNumber('1.234,56', ',')?.value).toBe(1234.56);
    expect(parseNumber('1.234.567', ',')?.value).toBe(1234567);
    expect(parseNumber('0,5', ',')?.value).toBe(0.5);
    expect(parseNumber('-12', ',')?.value).toBe(-12);
    expect(parseNumber('1 234,5', ',')?.value).toBe(1234.5);
  });

  it('lê números no formato americano', () => {
    expect(parseNumber('1,234.56', '.')?.value).toBe(1234.56);
    expect(parseNumber('0.5', '.')?.value).toBe(0.5);
  });

  it('entende moeda, porcentagem e negativos contábeis', () => {
    expect(parseNumber('R$ 1.234,56', ',')).toEqual({ value: 1234.56, kind: 'currency' });
    expect(parseNumber('R$ -10,00', ',')).toEqual({ value: -10, kind: 'currency' });
    expect(parseNumber('12,5%', ',')).toEqual({ value: 0.125, kind: 'percent' });
    expect(parseNumber('(1.500)', ',')?.value).toBe(-1500);
    expect(parseNumber('−3,2', ',')?.value).toBe(-3.2);
    expect(parseNumber('1,2E+03', ',')?.value).toBe(1200);
  });

  it('recusa texto e separadores de milhar mal formados', () => {
    expect(parseNumber('abc', ',')).toBeNull();
    expect(parseNumber('12/03/2024', ',')).toBeNull();
    expect(parseNumber('1.5', ',')).toBeNull();
    expect(parseNumber('-', ',')).toBeNull();
    expect(parseNumber('', ',')).toBeNull();
  });
});

describe('detectDecimalSeparator', () => {
  it('reconhece vírgula decimal', () => {
    expect(detectDecimalSeparator(['1.234,5', '10', '3,25'])).toBe(',');
  });
  it('reconhece ponto decimal', () => {
    expect(detectDecimalSeparator(['1,234.5', '3.25', '10'])).toBe('.');
  });
  it('assume vírgula quando é ambíguo', () => {
    expect(detectDecimalSeparator(['1.234', '10'])).toBe(',');
  });
});

describe('texto colado', () => {
  it('detecta tab, ponto e vírgula e vírgula', () => {
    expect(detectDelimiter('a\tb\n1\t2')).toBe('\t');
    expect(detectDelimiter('a;b\n1,5;2')).toBe(';');
    expect(detectDelimiter('a,b\n1,2')).toBe(',');
  });

  it('respeita aspas com quebra de linha (como o Excel copia)', () => {
    const rows = parseDelimited('"Nome\ncomposto"\t10\n"Diz ""oi"""\t20', '\t');
    expect(rows).toEqual([
      ['Nome\ncomposto', '10'],
      ['Diz "oi"', '20'],
    ]);
  });

  it('remove linhas e colunas vazias', () => {
    const grid = parsePastedText('A\t\tB\n\t\t\n1\t\t2\n');
    expect(grid).toEqual([
      ['A', 'B'],
      ['1', '2'],
    ]);
  });

  it('identifica porcentagens', () => {
    expect(detectHint(parsePastedText('Área\tNota\nA\t10%\nB\t20%'))).toBe('percent');
  });
});

describe('dataset', () => {
  const grid = parsePastedText('Produto\tJan\tFev\nA\t10\t20\nB\t5\t6\nA\t1\t1');

  it('usa colunas como séries por padrão', () => {
    const ds = buildDataset(grid, settings(), null);
    expect(ds.headerUsed).toBe(true);
    expect(ds.categories).toEqual(['A', 'B', 'A']);
    expect(ds.series.map((s) => s.name)).toEqual(['Jan', 'Fev']);
    expect(ds.series[0].values).toEqual([10, 5, 1]);
    expect(ds.notes.length).toBe(1);
  });

  it('inverte linhas e colunas', () => {
    const ds = buildDataset(grid, settings({ orientation: 'rows' }), null);
    expect(ds.categories).toEqual(['Jan', 'Fev']);
    expect(ds.series.map((s) => s.name)).toEqual(['A', 'B', 'A (2)']);
    expect(ds.series[1].values).toEqual([5, 6]);
  });

  it('agrupa categorias repetidas', () => {
    const sum = buildDataset(grid, settings({ aggregate: 'sum' }), null);
    expect(sum.categories).toEqual(['A', 'B']);
    expect(sum.series[0].values).toEqual([11, 5]);
    const avg = buildDataset(grid, settings({ aggregate: 'avg' }), null);
    expect(avg.series[1].values).toEqual([10.5, 6]);
    const count = buildDataset(grid, settings({ aggregate: 'count' }), null);
    expect(count.series[0].values).toEqual([2, 1]);
  });

  it('ordena, limita e junta o resto em Outros', () => {
    const g = parsePastedText('Item\tValor\na\t5\nb\t50\nc\t20\nd\t1\ne\t9');
    const ds = buildDataset(g, settings({ sort: 'desc', topN: 3, groupOthers: true }), null);
    expect(ds.categories).toEqual(['b', 'c', 'e', 'Outros']);
    expect(ds.series[0].values).toEqual([50, 20, 9, 6]);
    const alpha = buildDataset(g, settings({ sort: 'alpha' }), null);
    expect(alpha.categories).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('mantém a cor de cada série quando outra é desligada', () => {
    const all = buildDataset(grid, settings(), null);
    const onlyFev = buildDataset(grid, settings({ seriesFields: [2] }), null);
    expect(onlyFev.series[0].colorSlot).toBe(all.series[1].colorSlot);
  });

  it('esconde categorias escolhidas', () => {
    const ds = buildDataset(grid, settings({ hiddenCategories: ['B'] }), null);
    expect(ds.categories).toEqual(['A', 'A']);
  });

  it('trata anos no cabeçalho e na primeira coluna', () => {
    const years = parsePastedText('Região\t2021\t2022\nNorte\t1,5\t2,5\nSul\t3\t4');
    expect(detectHeader(years, ',')).toBe(true);
    const ds = buildDataset(years, settings(), null);
    expect(ds.series.map((s) => s.name)).toEqual(['2021', '2022']);

    const yearRows = parsePastedText('2019\t10\n2020\t12\n2021\t15');
    const ds2 = buildDataset(yearRows, settings(), null);
    expect(ds2.headerUsed).toBe(false);
    expect(ds2.categories).toEqual(['2019', '2020', '2021']);
    expect(ds2.series[0].values).toEqual([10, 12, 15]);
  });

  it('numera as categorias quando só há números', () => {
    const ds = buildDataset(parsePastedText('10\n20\n30'), settings(), null);
    expect(ds.categories).toEqual(['1', '2', '3']);
    expect(ds.series[0].values).toEqual([10, 20, 30]);
  });

  it('lê todos os exemplos', () => {
    for (const sample of SAMPLES) {
      const ds = buildDataset(parsePastedText(sample.tsv), settings(), detectHint(parsePastedText(sample.tsv)));
      expect(ds.series.length, sample.id).toBeGreaterThan(0);
      expect(ds.series.every((s) => s.values.every((v) => v !== null)), sample.id).toBe(true);
    }
  });
});

describe('utilidades', () => {
  it('gera letras de coluna como o Excel', () => {
    expect(columnLetter(0)).toBe('A');
    expect(columnLetter(25)).toBe('Z');
    expect(columnLetter(26)).toBe('AA');
    expect(columnLetter(701)).toBe('ZZ');
  });
  it('transpõe', () => {
    expect(transpose([[1, 2], [3, 4], [5, null]])).toEqual([
      [1, 3, 5],
      [2, 4, null],
    ]);
  });
});

describe('datas do Excel', () => {
  it('escreve meses em português', () => {
    const d = new Date(2025, 1, 1);
    expect(formatMonthDate(d, 'mmm/yy')).toBe('fev/25');
    expect(formatMonthDate(d, 'mmmm yyyy')).toBe('fevereiro 2025');
    expect(formatMonthDate(d, '[$-416]mmm-yy;@')).toBe('fev-25');
    expect(formatMonthDate(d, 'dd/mm/yyyy')).toBeNull();
    expect(formatDate(new Date(2025, 2, 9))).toBe('09/03/2025');
  });
});
