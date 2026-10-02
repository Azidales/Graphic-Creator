export type ChartType =
  | 'bar'
  | 'line'
  | 'area'
  | 'combo'
  | 'pie'
  | 'donut'
  | 'scatter'
  | 'radar'
  | 'funnel'
  | 'treemap'
  | 'waterfall'
  | 'heatmap'
  | 'lollipop'
  | 'dumbbell';

export type ColorMode = 'palette' | 'single' | 'highlight' | 'posneg' | 'gradient' | 'none';
export type LabelPosition = 'auto' | 'outside' | 'inside' | 'base' | 'center';
export type LabelContent = 'value' | 'percent' | 'value+percent' | 'category' | 'category+value' | 'series' | 'series+value';
export type LabelWhich = 'all' | 'last' | 'maxmin' | 'first+last';
export type NumberStyle = 'auto' | 'number' | 'compact' | 'percent' | 'currency';
export type LegendPosition = 'top' | 'bottom' | 'left' | 'right';
export type BackgroundMode = 'auto' | 'transparent' | 'white' | 'custom';
export type ChartTheme = 'auto' | 'light' | 'dark';
export type SizePreset = 'fit' | '16:9' | '4:3' | '1:1' | '9:16' | 'a4' | 'custom';

export interface SeriesStyle {
  color?: string;
  /** Tipo da série no gráfico combinado. */
  as?: 'bar' | 'line' | 'area';
  dashed?: boolean;
}

export interface NumberFormat {
  style: NumberStyle;
  /** Casas decimais; null = automático. */
  decimals: number | null;
  currency: 'BRL' | 'USD' | 'EUR';
  prefix: string;
  suffix: string;
  locale: 'pt-BR' | 'en-US';
}

export interface LabelConfig {
  show: boolean;
  position: LabelPosition;
  content: LabelContent;
  which: LabelWhich;
  size: number;
  bold: boolean;
}

export interface AxisConfig {
  show: boolean;
  title: string;
  grid: boolean;
  /** Rotação dos rótulos do eixo de categorias (graus). */
  rotate: number;
  min: number | null;
  max: number | null;
  log: boolean;
}

export interface ChartConfig {
  type: ChartType;
  horizontal: boolean;
  stack: 'none' | 'stacked' | 'percent';
  /** Um painel pequeno para cada série. */
  facet: boolean;
  facetSharedScale: boolean;

  title: string;
  subtitle: string;
  source: string;
  titleAlign: 'left' | 'center';
  fontFamily: string;
  fontScale: number;

  palette: string;
  colorMode: ColorMode;
  singleColor: string;
  highlight: string[];
  highlightColor: string;
  posColor: string;
  negColor: string;
  totalColor: string;
  ramp: string;
  varyColors: boolean;
  patterns: boolean;
  seriesStyle: Record<string, SeriesStyle>;
  categoryColors: Record<string, string>;

  theme: ChartTheme;
  background: BackgroundMode;
  backgroundColor: string;

  barWidth: number;
  barRadius: number;
  barGap: number;
  smooth: boolean;
  step: boolean;
  lineWidth: number;
  symbols: boolean;
  symbolSize: number;
  areaOpacity: number;
  connectNulls: boolean;
  innerRadius: number;
  rose: boolean;
  centerTotal: boolean;
  waterfallTotal: boolean;
  trendline: boolean;

  /** Rótulos dos gráficos com eixos. */
  labels: LabelConfig;
  /** Rótulos de pizza, rosca, funil e mosaico (guardados à parte: lá eles fazem mais sentido ligados). */
  partLabels: LabelConfig;
  number: NumberFormat;
  /** Eixo das categorias (X nas colunas, Y nas barras). */
  catAxis: AxisConfig;
  /** Eixo dos valores. */
  valAxis: AxisConfig;
  legend: { show: 'auto' | boolean; position: LegendPosition };
  reference: {
    average: boolean;
    target: boolean;
    targetValue: number;
    targetLabel: string;
  };
  tooltip: boolean;
  animation: boolean;

  size: { preset: SizePreset; width: number; height: number };
  exportScale: number;
}

export const FONT_OPTIONS: { id: string; name: string; css: string }[] = [
  { id: 'sistema', name: 'Sistema', css: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  { id: 'hanken', name: 'Hanken Grotesk', css: '"Hanken Grotesk", system-ui, sans-serif' },
  { id: 'bricolage', name: 'Bricolage Grotesque', css: '"Bricolage Grotesque", system-ui, sans-serif' },
  { id: 'serifa', name: 'Serifada', css: '"Source Serif 4", Georgia, "Times New Roman", serif' },
  { id: 'mono', name: 'Monoespaçada', css: '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace' },
];

export const DEFAULT_CONFIG: ChartConfig = {
  type: 'bar',
  horizontal: false,
  stack: 'none',
  facet: false,
  facetSharedScale: true,

  title: '',
  subtitle: '',
  source: '',
  titleAlign: 'left',
  fontFamily: 'hanken',
  fontScale: 1,

  palette: 'padrao',
  colorMode: 'palette',
  singleColor: '#2a78d6',
  highlight: [],
  highlightColor: '#eb6834',
  posColor: '#2a78d6',
  negColor: '#e34948',
  totalColor: '#52514e',
  ramp: 'azul',
  varyColors: false,
  patterns: false,
  seriesStyle: {},
  categoryColors: {},

  theme: 'auto',
  background: 'auto',
  backgroundColor: '#ffffff',

  barWidth: 60,
  barRadius: 4,
  barGap: 10,
  smooth: false,
  step: false,
  lineWidth: 2,
  symbols: true,
  symbolSize: 8,
  areaOpacity: 0.12,
  connectNulls: true,
  innerRadius: 55,
  rose: false,
  centerTotal: true,
  waterfallTotal: true,
  trendline: false,

  labels: { show: false, position: 'auto', content: 'value', which: 'all', size: 12, bold: false },
  partLabels: { show: true, position: 'outside', content: 'percent', which: 'all', size: 12, bold: false },
  number: { style: 'auto', decimals: null, currency: 'BRL', prefix: '', suffix: '', locale: 'pt-BR' },
  catAxis: { show: true, title: '', grid: false, rotate: 0, min: null, max: null, log: false },
  valAxis: { show: true, title: '', grid: true, rotate: 0, min: null, max: null, log: false },
  legend: { show: 'auto', position: 'top' },
  reference: { average: false, target: false, targetValue: 0, targetLabel: 'Meta' },
  tooltip: true,
  animation: true,

  size: { preset: 'fit', width: 1280, height: 720 },
  exportScale: 2,
};

export interface ChartTypeInfo {
  id: string;
  type: ChartType;
  horizontal?: boolean;
  name: string;
  hint: string;
}

/** Itens da galeria. "Colunas" e "Barras" são o mesmo tipo em orientações diferentes. */
export const CHART_GALLERY: ChartTypeInfo[] = [
  { id: 'column', type: 'bar', horizontal: false, name: 'Colunas', hint: 'Comparar valores entre categorias' },
  { id: 'barh', type: 'bar', horizontal: true, name: 'Barras', hint: 'Bom para nomes longos e rankings' },
  { id: 'line', type: 'line', name: 'Linhas', hint: 'Evolução ao longo do tempo' },
  { id: 'area', type: 'area', name: 'Área', hint: 'Evolução com volume' },
  { id: 'combo', type: 'combo', name: 'Combinado', hint: 'Colunas e linhas juntas' },
  { id: 'pie', type: 'pie', name: 'Pizza', hint: 'Partes de um todo (poucas fatias)' },
  { id: 'donut', type: 'donut', name: 'Rosca', hint: 'Partes de um todo, com total no centro' },
  { id: 'scatter', type: 'scatter', name: 'Dispersão', hint: 'Relação entre dois números' },
  { id: 'lollipop', type: 'lollipop', name: 'Pirulito', hint: 'Colunas mais leves' },
  { id: 'dumbbell', type: 'dumbbell', name: 'Halteres', hint: 'Antes × depois por categoria' },
  { id: 'waterfall', type: 'waterfall', name: 'Cascata', hint: 'Somas e subtrações até o total' },
  { id: 'radar', type: 'radar', name: 'Radar', hint: 'Perfil em várias dimensões' },
  { id: 'funnel', type: 'funnel', name: 'Funil', hint: 'Etapas de um processo' },
  { id: 'treemap', type: 'treemap', name: 'Mosaico', hint: 'Proporções em retângulos' },
  { id: 'heatmap', type: 'heatmap', name: 'Mapa de calor', hint: 'Tabela colorida pelo valor' },
];

export function galleryIdFor(config: Pick<ChartConfig, 'type' | 'horizontal'>): string {
  if (config.type === 'bar') return config.horizontal ? 'barh' : 'column';
  return config.type;
}

/** Tipos com eixo cartesiano (X/Y). */
export function isCartesian(type: ChartType): boolean {
  return ['bar', 'line', 'area', 'combo', 'scatter', 'waterfall', 'lollipop', 'dumbbell'].includes(type);
}

/** Tipos que usam uma única série (a primeira marcada). */
export function isSingleSeries(type: ChartType): boolean {
  return ['pie', 'donut', 'funnel', 'treemap', 'waterfall'].includes(type);
}

/** Tipos de "partes de um todo": usam `partLabels`. */
export function isPartType(type: ChartType): boolean {
  return ['pie', 'donut', 'funnel', 'treemap'].includes(type);
}

export function supportsStack(type: ChartType): boolean {
  return ['bar', 'line', 'area', 'combo'].includes(type);
}

export function supportsHorizontal(type: ChartType): boolean {
  return ['bar', 'waterfall', 'lollipop', 'dumbbell', 'funnel'].includes(type);
}

export function supportsFacet(type: ChartType): boolean {
  return ['bar', 'line', 'area', 'lollipop'].includes(type);
}
