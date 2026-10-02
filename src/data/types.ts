/** Uma célula como ela veio da fonte: texto colado, número do .xlsx ou vazia. */
export type Cell = string | number | null;

/** Tabela crua: linhas × colunas, como na planilha. */
export type Grid = Cell[][];

export interface Sheet {
  name: string;
  grid: Grid;
  /** Formato numérico predominante detectado na origem (ex.: células com %). */
  hint: NumberHint;
}

export type NumberHint = 'percent' | 'currency' | null;

export interface Workbook {
  /** De onde vieram os dados (nome do arquivo, "Colado", "Exemplo: ..."). */
  source: string;
  sheets: Sheet[];
}

export type Orientation = 'columns' | 'rows';
export type Aggregate = 'none' | 'sum' | 'avg' | 'count' | 'min' | 'max';
export type SortMode = 'none' | 'asc' | 'desc' | 'alpha';

/** Como transformar a planilha em categorias e séries. */
export interface DataSettings {
  sheetIndex: number;
  /** Séries nas colunas (padrão do Excel) ou nas linhas. */
  orientation: Orientation;
  /** Primeira linha (ou coluna, se séries em linhas) contém os nomes. */
  header: 'auto' | boolean;
  /** Campo usado como categoria / eixo X. -1 = numerar 1, 2, 3… ; null = automático. */
  categoryField: number | null;
  /** Campos usados como séries. null = todos os campos numéricos. */
  seriesFields: number[] | null;
  decimal: 'auto' | ',' | '.';
  aggregate: Aggregate;
  sort: SortMode;
  /** Ordenar por qual série (índice do campo). -1 = soma das séries. */
  sortField: number;
  /** Mostrar só as N maiores (0 = todas). */
  topN: number;
  /** Juntar o restante em "Outros" quando topN > 0. */
  groupOthers: boolean;
  /** Categorias escondidas pelo usuário. */
  hiddenCategories: string[];
}

export interface Field {
  index: number;
  name: string;
  numeric: boolean;
}

export interface Series {
  name: string;
  field: number;
  /** Posição estável na paleta: a cor segue a série, não a ordem. */
  colorSlot: number;
  values: (number | null)[];
}

export interface Dataset {
  fields: Field[];
  categoryField: number;
  categoryName: string;
  categories: string[];
  /** Valor numérico da categoria, quando ela é numérica (útil na dispersão). */
  categoryValues: (number | null)[];
  /** Posição estável de cada categoria na ordem original (para cores por categoria). */
  categorySlots: number[];
  series: Series[];
  hint: NumberHint;
  headerUsed: boolean;
  decimalUsed: ',' | '.';
  /** Todas as categorias antes de filtros (para a lista de "mostrar/esconder"). */
  allCategories: string[];
  notes: string[];
}
