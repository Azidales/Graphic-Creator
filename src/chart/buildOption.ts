/* eslint-disable @typescript-eslint/no-explicit-any */
// Transforma (dados + configuração) em uma opção do ECharts.
// Tudo que depende de pixels (pizza, painéis, legenda lateral) usa o tamanho real do gráfico.

import type { Dataset, Series } from '../data/types';
import { OTHERS_LABEL } from '../data/dataset';
import {
  FONT_OPTIONS,
  isPartType,
  isSingleSeries,
  supportsFacet,
  type ChartConfig,
  type LabelConfig,
  type NumberFormat,
} from './config';
import { formatPercentShare, makeFormatter, type Formatter } from './format';
import { getPalette, getRamp, mix, shades, textOn } from './palettes';

export interface BuildEnv {
  width: number;
  height: number;
  /** O app está no tema escuro? (usado quando o gráfico segue o tema). */
  uiDark: boolean;
  reducedMotion?: boolean;
}

export interface Ink {
  text: string;
  text2: string;
  muted: string;
  grid: string;
  axis: string;
  surface: string;
  faded: string;
}

export const INK_LIGHT: Ink = {
  text: '#0b0b0b',
  text2: '#52514e',
  muted: '#898781',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  surface: '#fcfcfb',
  faded: '#d6d5cf',
};

export const INK_DARK: Ink = {
  text: '#ffffff',
  text2: '#c3c2b7',
  muted: '#898781',
  grid: '#2c2c2a',
  axis: '#45443f',
  surface: '#1a1a19',
  faded: '#4a4a47',
};

const GRAYS_LIGHT = ['#3d3d3a', '#8a8984', '#b9b8b2', '#5f5e5a', '#d5d4ce', '#2a2a28', '#a09f99', '#74736e'];
const GRAYS_DARK = ['#e8e8e4', '#a3a29c', '#6f6e69', '#c9c8c2', '#55544f', '#f5f5f2', '#8a8984', '#b5b4ae'];

export interface Built {
  option: any;
  notes: string[];
  dark: boolean;
  background: string;
}

interface Rect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface Ctx {
  ds: Dataset;
  cfg: ChartConfig;
  env: BuildEnv;
  dark: boolean;
  ink: Ink;
  bg: string;
  /** Cor usada para os "vãos" entre marcas (o fundo, ou a superfície se o fundo é transparente). */
  gap: string;
  font: string;
  s: number;
  fmt: Formatter;
  fmtAxis: Formatter;
  numberFormat: NumberFormat;
  pal: string[];
  series: Series[];
  notes: string[];
  plot: Rect;
  labels: LabelConfig;
  horizontal: boolean;
  highlightSeries: boolean;
  /** Valores normalizados (100% empilhado) por série. */
  shown: (number | null)[][];
  categoryTotals: number[];
  seriesTotals: number[];
  vmin: number;
  vmax: number;
}

// ---------------------------------------------------------------------------
// Cores

function paletteColor(ctx: Ctx, slot: number): string {
  const { pal } = ctx;
  const base = pal[slot % pal.length];
  const cycle = Math.floor(slot / pal.length);
  return cycle === 0 ? base : mix(base, ctx.ink.surface, Math.min(0.6, 0.35 * cycle));
}

function seriesColor(ctx: Ctx, s: Series, k: number): string {
  const { cfg } = ctx;
  const n = ctx.series.length;
  if (cfg.colorMode === 'single') return n === 1 ? cfg.singleColor : shades(cfg.singleColor, n, ctx.dark)[k];
  if (cfg.colorMode === 'none') return (ctx.dark ? GRAYS_DARK : GRAYS_LIGHT)[k % GRAYS_LIGHT.length];
  const own = cfg.seriesStyle[s.name]?.color ?? paletteColor(ctx, s.colorSlot);
  if (cfg.colorMode === 'highlight' && ctx.highlightSeries) {
    return cfg.highlight.includes(s.name) ? own : ctx.ink.faded;
  }
  return own;
}

function rampColor(ctx: Ctx, v: number | null): string {
  const ramp = getRamp(ctx.cfg.ramp);
  const lo = ctx.dark ? mix(ramp.to, ctx.ink.surface, 0.35) : ramp.from;
  const hi = ctx.dark ? ramp.from : ramp.to;
  if (v === null) return ctx.ink.faded;
  const span = ctx.vmax - ctx.vmin;
  const t = span === 0 ? 1 : (v - ctx.vmin) / span;
  // Começa em 15% para o menor valor não sumir no fundo.
  return mix(lo, hi, 0.15 + 0.85 * Math.max(0, Math.min(1, t)));
}

/** Cor de um ponto (barra, fatia, bolinha) — modos que colorem ponto a ponto. */
function pointColor(ctx: Ctx, base: string, i: number, v: number | null, perCategory: boolean): string {
  const { cfg, ds } = ctx;
  const cat = ds.categories[i];
  const single = ctx.series.length === 1 || perCategory;
  if (single && cfg.categoryColors[cat] && cfg.colorMode === 'palette') return cfg.categoryColors[cat];
  switch (cfg.colorMode) {
    case 'posneg':
      return (v ?? 0) >= 0 ? cfg.posColor : cfg.negColor;
    case 'gradient':
      return rampColor(ctx, v);
    case 'highlight': {
      if (ctx.highlightSeries || cfg.highlight.length === 0) return base;
      const on = cfg.highlight.includes(cat);
      if (single) return on ? cfg.highlightColor : ctx.ink.faded;
      return on ? base : mix(base, ctx.gap, 0.72);
    }
    case 'single':
      if (perCategory) return shades(cfg.singleColor, ds.categories.length, ctx.dark)[i] ?? cfg.singleColor;
      return base;
    case 'none':
      if (perCategory) return (ctx.dark ? GRAYS_DARK : GRAYS_LIGHT)[i % GRAYS_LIGHT.length];
      return base;
    default:
      if (cat === OTHERS_LABEL && perCategory) return ctx.ink.faded;
      if (perCategory || (cfg.varyColors && ctx.series.length === 1)) return paletteColor(ctx, ds.categorySlots[i] ?? i);
      return base;
  }
}

// ---------------------------------------------------------------------------
// Rótulos

function labelIndices(values: (number | null)[], which: LabelConfig['which']): Set<number> {
  const idx = values.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0);
  if (which === 'all' || idx.length === 0) return new Set(idx);
  if (which === 'last') return new Set([idx[idx.length - 1]]);
  if (which === 'first+last') return new Set([idx[0], idx[idx.length - 1]]);
  let max = idx[0];
  let min = idx[0];
  for (const i of idx) {
    if ((values[i] as number) > (values[max] as number)) max = i;
    if ((values[i] as number) < (values[min] as number)) min = i;
  }
  return new Set([max, min]);
}

function share(ctx: Ctx, k: number, i: number): number | null {
  const v = ctx.series[k]?.values[i];
  if (v === null || v === undefined) return null;
  const useCategory = ctx.series.length > 1;
  const total = useCategory ? ctx.categoryTotals[i] : ctx.seriesTotals[k];
  return total ? Math.abs(v) / total : null;
}

function labelText(ctx: Ctx, k: number, i: number, content = ctx.labels.content): string {
  const s = ctx.series[k];
  const v = s?.values[i] ?? null;
  const value = ctx.fmt(v);
  const sh = share(ctx, k, i);
  const pct = sh === null ? '' : formatPercentShare(sh, ctx.numberFormat.locale);
  const cat = ctx.ds.categories[i] ?? '';
  switch (content) {
    case 'percent':
      return pct;
    case 'value+percent':
      return pct ? `${value} (${pct})` : value;
    case 'category':
      return cat;
    case 'category+value':
      return `${cat}: ${value}`;
    case 'series':
      return s?.name ?? '';
    case 'series+value':
      return `${s?.name ?? ''}: ${value}`;
    default:
      return value;
  }
}

function labelStyle(ctx: Ctx, extra: Record<string, any> = {}): Record<string, any> {
  return {
    fontSize: ctx.labels.size * ctx.s,
    fontWeight: ctx.labels.bold ? 600 : 400,
    color: ctx.ink.text2,
    fontFamily: ctx.font,
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Utilidades

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function niceCeil(x: number): number {
  if (x <= 0) return x;
  const mag = 10 ** Math.floor(Math.log10(x));
  for (const step of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (step * mag >= x - 1e-12) return step * mag;
  }
  return 10 * mag;
}

function linearFit(xs: number[], ys: (number | null)[]): ((x: number) => number) | null {
  const pts = xs.map((x, i) => [x, ys[i]] as const).filter((p): p is readonly [number, number] => p[1] !== null);
  if (pts.length < 2) return null;
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p[0], 0) / n;
  const my = pts.reduce((a, p) => a + p[1], 0) / n;
  let num = 0;
  let den = 0;
  for (const [x, y] of pts) {
    num += (x - mx) * (y - my);
    den += (x - mx) ** 2;
  }
  if (den === 0) return null;
  const b = num / den;
  const a = my - b * mx;
  return (x) => a + b * x;
}

function textWidth(text: string, size: number): number {
  return text.length * size * 0.56;
}

function missing(v: number | null): number | string {
  return v === null ? '-' : v;
}

// ---------------------------------------------------------------------------
// Construção

export function buildOption(ds: Dataset, cfg: ChartConfig, env: BuildEnv): Built {
  const notes: string[] = [];
  const bgRaw = cfg.background;
  let dark = cfg.theme === 'dark' || (cfg.theme === 'auto' && env.uiDark);
  if (cfg.theme === 'auto' && bgRaw === 'white') dark = false;
  if (cfg.theme === 'auto' && bgRaw === 'custom') dark = isDarkColor(cfg.backgroundColor);
  const ink = dark ? INK_DARK : INK_LIGHT;
  const bg =
    bgRaw === 'transparent' ? 'transparent' : bgRaw === 'white' ? '#ffffff' : bgRaw === 'custom' ? cfg.backgroundColor : ink.surface;
  const gap = bg === 'transparent' ? ink.surface : bg;
  const font = (FONT_OPTIONS.find((f) => f.id === cfg.fontFamily) ?? FONT_OPTIONS[0]).css;
  const s = cfg.fontScale;
  const palette = getPalette(cfg.palette);

  let series = ds.series;
  if (isSingleSeries(cfg.type) && series.length > 1) {
    notes.push(`Este tipo de gráfico usa uma série só: "${series[0].name}". Desmarque as outras ou escolha qual fica na aba Dados.`);
    series = series.slice(0, 1);
  }
  if ((cfg.type === 'dumbbell') && series.length < 2) {
    notes.push('O gráfico de halteres precisa de pelo menos duas séries (por exemplo, dois anos).');
  }

  const numberFormat: NumberFormat =
    cfg.number.style === 'auto' && ds.hint === 'percent'
      ? { ...cfg.number, style: 'percent' }
      : cfg.number.style === 'auto' && ds.hint === 'currency'
        ? { ...cfg.number, style: 'currency' }
        : cfg.number;

  const all = series.flatMap((x) => x.values).filter((v): v is number => v !== null);
  const fmt = makeFormatter(numberFormat, all);
  const fmtAxis = makeFormatter(numberFormat, all, { compactAuto: true });

  const nCat = ds.categories.length;
  const categoryTotals = ds.categories.map((_, i) => series.reduce((a, x) => a + Math.abs(x.values[i] ?? 0), 0));
  const seriesTotals = series.map((x) => x.values.reduce<number>((a, v) => a + Math.abs(v ?? 0), 0));
  const percentStack = cfg.stack === 'percent' && ['bar', 'line', 'area', 'combo'].includes(cfg.type);
  const shown = series.map((x) =>
    percentStack ? x.values.map((v, i) => (v === null || !categoryTotals[i] ? null : v / categoryTotals[i])) : x.values,
  );

  const horizontal = ['bar', 'waterfall', 'lollipop', 'dumbbell', 'funnel'].includes(cfg.type) && cfg.horizontal;
  const highlightSeries = cfg.colorMode === 'highlight' && series.length > 1 && cfg.highlight.some((h) => series.some((x) => x.name === h));

  const ctx: Ctx = {
    ds,
    cfg,
    env,
    dark,
    ink,
    bg,
    gap,
    font,
    s,
    fmt,
    fmtAxis,
    numberFormat,
    pal: dark ? palette.dark : palette.light,
    series,
    notes,
    plot: { top: 0, bottom: 0, left: 0, right: 0 },
    labels: isPartType(cfg.type) ? cfg.partLabels : cfg.labels,
    horizontal,
    highlightSeries,
    shown,
    categoryTotals,
    seriesTotals,
    vmin: all.length ? Math.min(...all) : 0,
    vmax: all.length ? Math.max(...all) : 0,
  };

  if (cfg.colorMode === 'highlight' && cfg.highlight.length === 0) {
    notes.push('Modo destaque: escolha na aba Visual quais categorias ou séries ficam em evidência.');
  }

  // --- Cabeçalho, rodapé e legenda definem a área do gráfico ---
  const pad = Math.round(Math.max(12, Math.min(24, Math.min(env.width, env.height) * 0.03)));
  const title: any[] = [];
  const graphic: any[] = [];
  let top = pad;
  let bottom = pad;
  let left = pad;
  let right = pad;
  const titleSize = Math.round(20 * s);
  const subSize = Math.round(13 * s);
  if (cfg.title || cfg.subtitle) {
    title.push({
      text: cfg.title,
      subtext: cfg.subtitle,
      left: cfg.titleAlign === 'center' ? 'center' : pad - 5,
      top: pad - 5,
      itemGap: 6,
      textStyle: { color: ink.text, fontSize: titleSize, fontWeight: 650, fontFamily: font },
      subtextStyle: { color: ink.text2, fontSize: subSize, fontFamily: font },
    });
    top += (cfg.title ? titleSize * 1.25 : 0) + (cfg.subtitle ? subSize * 1.35 + 6 : 0) + 12;
  }
  if (cfg.source) {
    graphic.push({
      type: 'text',
      left: pad,
      bottom: Math.round(pad * 0.7),
      silent: true,
      style: { text: cfg.source, fill: ink.muted, font: `${Math.round(11 * s)}px ${font}` },
    });
    bottom += 11 * s + 10;
  }

  const legendNames = legendItems(ctx);
  const legendAuto =
    legendNames.length >= 2 &&
    !isPartType(cfg.type) &&
    cfg.type !== 'heatmap' &&
    !(cfg.facet && supportsFacet(cfg.type));
  const legendShow = (cfg.legend.show === 'auto' ? legendAuto : cfg.legend.show) && legendNames.length > 0;
  let legend: any = { show: false };
  if (legendShow) {
    const pos = cfg.legend.position;
    const vertical = pos === 'left' || pos === 'right';
    const itemText = { color: ink.text2, fontSize: Math.round(12 * s), fontFamily: font };
    legend = {
      show: true,
      type: 'scroll',
      data: legendNames,
      orient: vertical ? 'vertical' : 'horizontal',
      itemWidth: 14,
      itemHeight: 10,
      itemGap: 14,
      textStyle: itemText,
      pageTextStyle: { color: ink.muted },
      pageIconColor: ink.text2,
      pageIconInactiveColor: ink.faded,
      icon: 'roundRect',
      selectedMode: cfg.type === 'waterfall' ? false : true,
    };
    if (pos === 'top') {
      Object.assign(legend, { top, left: cfg.titleAlign === 'center' ? 'center' : pad - 5 });
      top += 26 * s + 6;
    } else if (pos === 'bottom') {
      Object.assign(legend, { bottom, left: 'center' });
      bottom += 26 * s + 6;
    } else {
      const w = Math.min(220, Math.max(...legendNames.map((n) => textWidth(n, 12 * s))) + 34);
      Object.assign(legend, { top: 'middle', [pos]: pad, width: w });
      if (pos === 'left') left += w + 8;
      else right += w + 8;
    }
  }
  ctx.plot = { top, bottom, left, right };

  // --- Corpo por tipo ---
  let body: any;
  switch (cfg.type) {
    case 'pie':
    case 'donut':
      body = buildPie(ctx, graphic);
      break;
    case 'radar':
      body = buildRadar(ctx);
      break;
    case 'funnel':
      body = buildFunnel(ctx);
      break;
    case 'treemap':
      body = buildTreemap(ctx);
      break;
    case 'heatmap':
      body = buildHeatmap(ctx);
      break;
    case 'waterfall':
      body = buildWaterfall(ctx);
      break;
    case 'dumbbell':
      body = buildDumbbell(ctx);
      break;
    default:
      body = cfg.facet && supportsFacet(cfg.type) && series.length > 1 ? buildFacets(ctx, title) : buildCartesian(ctx);
  }

  const animate = cfg.animation && !env.reducedMotion;
  const baseTooltip = {
    show: cfg.tooltip,
    confine: true,
    backgroundColor: ink.surface,
    borderColor: ink.grid,
    borderWidth: 1,
    padding: [8, 10],
    textStyle: { color: ink.text, fontFamily: font, fontSize: 12 },
    extraCssText: 'box-shadow: 0 6px 24px rgba(0,0,0,.12); border-radius: 8px;',
  };
  const option: any = {
    backgroundColor: bg,
    color: ctx.pal,
    textStyle: { fontFamily: font, color: ink.text2 },
    title,
    legend,
    graphic,
    animation: animate,
    animationDuration: 450,
    animationDurationUpdate: 350,
    aria: {
      enabled: true,
      decal: { show: cfg.patterns || (cfg.colorMode === 'none' && (series.length > 1 || isPartType(cfg.type))) },
    },
    ...body,
    tooltip: { ...baseTooltip, ...(body.tooltip ?? {}) },
  };
  if (nCat === 0 || series.length === 0) {
    option.series = [];
    option.graphic = [
      ...graphic,
      {
        type: 'text',
        left: 'center',
        top: 'middle',
        style: { text: 'Sem dados numéricos para desenhar', fill: ink.muted, font: `14px ${font}` },
      },
    ];
  }
  return { option, notes, dark, background: bg };
}

function isDarkColor(hex: string): boolean {
  const m = hex.replace('#', '');
  if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(m)) return false;
  return textOn(hex) === '#ffffff';
}

function legendItems(ctx: Ctx): string[] {
  const { cfg, series, ds } = ctx;
  if (cfg.type === 'waterfall') return ['Aumento', 'Redução', ...(cfg.waterfallTotal ? ['Total'] : [])];
  if (isPartType(cfg.type)) return ds.categories;
  if (cfg.type === 'heatmap') return [];
  return series.map((s) => s.name);
}

// ---------------------------------------------------------------------------
// Eixos

function categoryAxis(ctx: Ctx, opts: { boundaryGap: boolean; gridIndex?: number; compact?: boolean }): any {
  const { cfg, ink, ds, s, horizontal } = ctx;
  const n = ds.categories.length;
  const plotW = ctx.env.width - ctx.plot.left - ctx.plot.right;
  const axisLabel: any = {
    show: cfg.catAxis.show,
    color: ink.text2,
    fontSize: Math.round(12 * s),
    fontFamily: ctx.font,
    rotate: horizontal ? 0 : cfg.catAxis.rotate,
    hideOverlap: true,
    interval: n <= 40 ? 0 : 'auto',
  };
  if (horizontal) {
    axisLabel.width = Math.round(Math.min(200, ctx.env.width * 0.28));
    axisLabel.overflow = 'truncate';
  } else if (!cfg.catAxis.rotate && n <= 16 && !opts.compact) {
    axisLabel.width = Math.max(40, Math.floor((plotW - 60) / Math.max(1, n)) - 6);
    axisLabel.overflow = 'break';
  }
  return {
    type: 'category',
    data: ds.categories,
    gridIndex: opts.gridIndex ?? 0,
    inverse: horizontal,
    boundaryGap: opts.boundaryGap,
    name: opts.compact ? '' : cfg.catAxis.title,
    nameLocation: 'middle',
    nameGap: horizontal ? 50 : 32,
    nameTextStyle: { color: ink.text2, fontSize: Math.round(12 * s), fontWeight: 600, fontFamily: ctx.font },
    axisLine: { show: cfg.catAxis.show, lineStyle: { color: ink.axis, width: 1 } },
    axisTick: { show: false },
    axisLabel,
    splitLine: { show: cfg.catAxis.grid, lineStyle: { color: ink.grid, width: 1 } },
  };
}

function valueAxis(
  ctx: Ctx,
  opts: { gridIndex?: number; percent?: boolean; scale?: boolean; max?: number; min?: number; compact?: boolean; values?: number[] } = {},
): any {
  const { cfg, ink, s } = ctx;
  const vals = opts.values ?? ctx.series.flatMap((x) => x.values).filter((v): v is number => v !== null);
  const canLog = vals.length > 0 && vals.every((v) => v > 0);
  if (cfg.valAxis.log && !canLog && !ctx.notes.includes(LOG_NOTE)) ctx.notes.push(LOG_NOTE);
  const log = cfg.valAxis.log && canLog && !opts.percent;
  const axis: any = {
    type: log ? 'log' : 'value',
    gridIndex: opts.gridIndex ?? 0,
    scale: opts.scale ?? false,
    name: opts.compact ? '' : cfg.valAxis.title,
    nameLocation: 'middle',
    nameGap: 44,
    nameTextStyle: { color: ink.text2, fontSize: Math.round(12 * s), fontWeight: 600, fontFamily: ctx.font },
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      show: cfg.valAxis.show,
      color: ink.muted,
      fontSize: Math.round(11 * s),
      fontFamily: ctx.font,
      formatter: opts.percent ? (v: number) => formatPercentShare(v, ctx.numberFormat.locale) : (v: number) => ctx.fmtAxis(v),
      hideOverlap: true,
    },
    splitLine: { show: cfg.valAxis.grid, lineStyle: { color: ink.grid, width: 1 } },
  };
  if (opts.percent) {
    axis.max = (e: { max: number }) => (e.max > 0 ? 1 : 0);
    axis.min = (e: { min: number }) => (e.min < 0 ? -1 : 0);
  }
  if (cfg.valAxis.min !== null && !opts.percent) axis.min = cfg.valAxis.min;
  if (cfg.valAxis.max !== null && !opts.percent) axis.max = cfg.valAxis.max;
  if (opts.max !== undefined && cfg.valAxis.max === null) axis.max = opts.max;
  if (opts.min !== undefined && cfg.valAxis.min === null) axis.min = opts.min;
  return axis;
}

const LOG_NOTE = 'A escala logarítmica só funciona com valores maiores que zero; usei a escala normal.';

function gridFor(rect: Rect): any {
  return {
    top: rect.top,
    bottom: rect.bottom,
    left: rect.left,
    right: rect.right,
    outerBoundsMode: 'same',
    outerBoundsContain: 'all',
  };
}

// ---------------------------------------------------------------------------
// Colunas, barras, linhas, área, combinado, pirulito e dispersão

function seriesKind(ctx: Ctx, s: Series, k: number): 'bar' | 'line' | 'area' | 'lollipop' | 'scatter' {
  const t = ctx.cfg.type;
  if (t === 'combo') return ctx.cfg.seriesStyle[s.name]?.as ?? (k === 0 ? 'bar' : 'line');
  if (t === 'line' || t === 'area' || t === 'lollipop' || t === 'scatter') return t;
  return 'bar';
}

function referenceLines(ctx: Ctx, k: number, color: string): any {
  const { cfg, ink } = ctx;
  if (cfg.stack === 'percent') return undefined;
  const data: any[] = [];
  const valueKey = ctx.horizontal ? 'xAxis' : 'yAxis';
  if (cfg.reference.average) {
    data.push({
      type: 'average',
      name: 'Média',
      lineStyle: { color, type: [2, 3], width: 1.5 },
      label: {
        formatter: (p: any) => `Média ${ctx.fmt(p.value)}`,
        color: ink.text2,
        position: 'insideEndTop',
        fontSize: Math.round(11 * ctx.s),
      },
    });
  }
  if (cfg.reference.target && k === 0) {
    data.push({
      [valueKey]: cfg.reference.targetValue,
      name: cfg.reference.targetLabel,
      lineStyle: { color: ink.text, type: [6, 4], width: 1.5 },
      label: {
        formatter: () => `${cfg.reference.targetLabel} ${ctx.fmt(cfg.reference.targetValue)}`.trim(),
        color: ink.text,
        fontWeight: 600,
        position: 'insideEndTop',
        fontSize: Math.round(11 * ctx.s),
      },
    });
  }
  if (!data.length) return undefined;
  return { silent: true, symbol: ['none', 'none'], data };
}

function barLabelPosition(ctx: Ctx, v: number | null, stacked: boolean): string {
  const { labels } = ctx;
  const neg = (v ?? 0) < 0;
  const outside = ctx.horizontal ? (neg ? 'left' : 'right') : neg ? 'bottom' : 'top';
  switch (labels.position) {
    case 'inside':
    case 'center':
      return 'inside';
    case 'base':
      return ctx.horizontal ? (neg ? 'insideRight' : 'insideLeft') : neg ? 'insideTop' : 'insideBottom';
    case 'outside':
      return outside;
    default:
      return stacked ? 'inside' : outside;
  }
}

function buildCartesianSeries(ctx: Ctx, s: Series, k: number, opts: { axisIndex?: number; groupSize?: number; groupIndex?: number } = {}): any[] {
  const { cfg, ink } = ctx;
  const kind = seriesKind(ctx, s, k);
  const color = seriesColor(ctx, s, k);
  const stacked = cfg.stack !== 'none' && kind !== 'lollipop' && kind !== 'scatter' && !(cfg.facet && supportsFacet(cfg.type));
  const values = ctx.shown[k];
  const which = labelIndices(s.values, ctx.labels.which);
  const dashed = cfg.seriesStyle[s.name]?.dashed;
  const axisIndex = opts.axisIndex ?? 0;
  const lastInStack = stacked && ctx.series.slice(k + 1).every((_, j) => seriesKind(ctx, ctx.series[k + 1 + j], k + 1 + j) !== kind);
  const out: any[] = [];
  const common = {
    id: `s-${s.field}`,
    name: s.name,
    xAxisIndex: axisIndex,
    yAxisIndex: axisIndex,
    universalTransition: true,
    markLine: referenceLines(ctx, k, color),
  };

  if (kind === 'bar') {
    const r = cfg.barRadius;
    const rounded = !stacked || lastInStack;
    out.push({
      ...common,
      type: 'bar',
      stack: stacked ? 'total' : undefined,
      barCategoryGap: `${100 - cfg.barWidth}%`,
      barGap: `${cfg.barGap}%`,
      itemStyle: {
        color,
        borderColor: stacked ? ctx.gap : undefined,
        borderWidth: stacked ? 1 : 0,
      },
      emphasis: { focus: ctx.series.length > 1 ? 'series' : 'none' },
      labelLayout: { hideOverlap: true },
      label: {
        show: ctx.labels.show,
        ...labelStyle(ctx),
        formatter: (p: any) => (which.has(p.dataIndex) ? labelText(ctx, k, p.dataIndex) : ''),
      },
      data: values.map((v, i) => {
        const c = pointColor(ctx, color, i, s.values[i], false);
        const neg = (v ?? 0) < 0;
        const radius = !rounded || r === 0
          ? 0
          : ctx.horizontal
            ? neg ? [r, 0, 0, r] : [0, r, r, 0]
            : neg ? [0, 0, r, r] : [r, r, 0, 0];
        const pos = barLabelPosition(ctx, v, stacked);
        const inside = pos.startsWith('inside');
        return {
          value: missing(v),
          itemStyle: { color: c, borderRadius: radius },
          label: { position: pos, color: inside ? textOn(c) : ink.text2 },
        };
      }),
    });
  } else if (kind === 'line' || kind === 'area') {
    const posMap: Record<string, string> = { auto: 'top', outside: 'top', base: 'bottom', inside: 'inside', center: 'inside' };
    const useEnd = ctx.labels.show && ctx.labels.which === 'last';
    out.push({
      ...common,
      type: 'line',
      stack: stacked ? 'total' : undefined,
      smooth: cfg.smooth && !cfg.step ? 0.35 : false,
      step: cfg.step ? 'middle' : false,
      connectNulls: cfg.connectNulls,
      symbol: 'circle',
      symbolSize: cfg.symbolSize,
      showSymbol: cfg.symbols,
      lineStyle: { width: cfg.lineWidth, color, type: dashed ? [8, 5] : 'solid', cap: 'round', join: 'round' },
      itemStyle: { color, borderColor: ctx.gap, borderWidth: 2 },
      areaStyle: kind === 'area' ? { color, opacity: cfg.areaOpacity } : undefined,
      emphasis: { focus: ctx.series.length > 1 ? 'series' : 'none' },
      labelLayout: { hideOverlap: true },
      label: {
        show: ctx.labels.show && !useEnd,
        position: posMap[ctx.labels.position] ?? 'top',
        ...labelStyle(ctx),
        formatter: (p: any) => (which.has(p.dataIndex) ? labelText(ctx, k, p.dataIndex) : ''),
      },
      endLabel: useEnd
        ? {
            show: true,
            ...labelStyle(ctx),
            distance: 8,
            formatter: () => {
              const i = [...which][0];
              return i === undefined ? '' : labelText(ctx, k, i);
            },
          }
        : undefined,
      data: values.map((v, i) => {
        const c = pointColor(ctx, color, i, s.values[i], false);
        return c === color ? missing(v) : { value: missing(v), itemStyle: { color: c } };
      }),
    });
  } else if (kind === 'lollipop') {
    const n = opts.groupSize ?? ctx.series.length;
    const gi = opts.groupIndex ?? k;
    out.push({
      ...common,
      type: 'custom',
      encode: ctx.horizontal ? { y: 0, x: 1, tooltip: 1 } : { x: 0, y: 1, tooltip: 1 },
      data: values.map((v, i) => [i, missing(v)]),
      renderItem: (_params: any, api: any) => {
        const i = api.value(0);
        const v = api.value(1);
        if (v === '-' || v === null || Number.isNaN(v)) return null;
        const band = ctx.horizontal ? api.size([0, 1])[1] : api.size([1, 0])[0];
        const group = band * (cfg.barWidth / 100);
        const offset = n > 1 ? -group / 2 + (group * (gi + 0.5)) / n : 0;
        const base = api.coord(ctx.horizontal ? [0, i] : [i, 0]);
        const tip = api.coord(ctx.horizontal ? [v, i] : [i, v]);
        if (ctx.horizontal) {
          base[1] += offset;
          tip[1] += offset;
        } else {
          base[0] += offset;
          tip[0] += offset;
        }
        const c = pointColor(ctx, color, i, s.values[i], false);
        const r = Math.max(3, cfg.symbolSize / 2 + 1);
        const children: any[] = [
          {
            type: 'line',
            shape: { x1: base[0], y1: base[1], x2: tip[0], y2: tip[1] },
            style: { stroke: c, lineWidth: Math.max(1.5, cfg.lineWidth), lineCap: 'round' },
          },
          {
            type: 'circle',
            shape: { cx: tip[0], cy: tip[1], r },
            style: { fill: c, stroke: ctx.gap, lineWidth: 2 },
          },
        ];
        if (ctx.labels.show && which.has(i)) {
          const neg = v < 0;
          const d = r + 6;
          children.push({
            type: 'text',
            x: ctx.horizontal ? tip[0] + (neg ? -d : d) : tip[0],
            y: ctx.horizontal ? tip[1] : tip[1] + (neg ? d : -d),
            style: {
              text: labelText(ctx, k, i),
              fill: ink.text2,
              font: `${ctx.labels.bold ? 600 : 400} ${Math.round(ctx.labels.size * ctx.s)}px ${ctx.font}`,
              align: ctx.horizontal ? (neg ? 'right' : 'left') : 'center',
              verticalAlign: ctx.horizontal ? 'middle' : neg ? 'top' : 'bottom',
            },
          });
        }
        return { type: 'group', children };
      },
      itemStyle: { color },
    });
  } else if (kind === 'scatter') {
    const numericX = ctx.ds.categoryValues.length > 0 && ctx.ds.categoryValues.every((x) => x !== null);
    out.push({
      ...common,
      type: 'scatter',
      symbolSize: Math.max(6, cfg.symbolSize + 2),
      itemStyle: { color, opacity: 0.88, borderColor: ctx.gap, borderWidth: 1 },
      labelLayout: { hideOverlap: true },
      label: {
        show: ctx.labels.show,
        position: 'right',
        ...labelStyle(ctx),
        formatter: (p: any) => (which.has(p.dataIndex) ? labelText(ctx, k, p.dataIndex) : ''),
      },
      emphasis: { focus: 'series', scale: 1.3 },
      data: values.map((v, i) => {
        const c = pointColor(ctx, color, i, s.values[i], false);
        const value = numericX ? [ctx.ds.categoryValues[i], missing(v)] : [i, missing(v)];
        return { value, name: ctx.ds.categories[i], itemStyle: c === color ? undefined : { color: c } };
      }),
    });
  }

  if (cfg.trendline && cfg.stack === 'none' && kind !== 'area') {
    const numericX = kind === 'scatter' && ctx.ds.categoryValues.every((x) => x !== null);
    const xs = numericX ? (ctx.ds.categoryValues as number[]) : s.values.map((_, i) => i);
    const fit = linearFit(xs, s.values);
    if (fit) {
      let data: any[];
      if (numericX) {
        const lo = Math.min(...xs);
        const hi = Math.max(...xs);
        data = [
          [lo, fit(lo)],
          [hi, fit(hi)],
        ];
      } else {
        data = xs.map((x) => (ctx.horizontal ? [fit(x), x] : [x, fit(x)]));
      }
      out.push({
        id: `trend-${s.field}`,
        name: `Tendência · ${s.name}`,
        type: 'line',
        xAxisIndex: axisIndex,
        yAxisIndex: axisIndex,
        data,
        symbol: 'none',
        silent: true,
        z: 5,
        tooltip: { show: false },
        lineStyle: { color: mix(color, ink.text, 0.25), type: [6, 4], width: 1.5 },
        emphasis: { disabled: true },
      });
    }
  }
  return out;
}

function axisTooltip(ctx: Ctx): any {
  const percent = ctx.cfg.stack === 'percent';
  return {
    trigger: 'axis',
    axisPointer: {
      type: ctx.cfg.type === 'line' || ctx.cfg.type === 'area' ? 'line' : 'shadow',
      lineStyle: { color: ctx.ink.axis },
      shadowStyle: { color: ctx.dark ? 'rgba(255,255,255,0.05)' : 'rgba(11,11,11,0.04)' },
    },
    formatter: (params: any) => {
      const list = (Array.isArray(params) ? params : [params]).filter((p: any) => !String(p.seriesId).startsWith('trend-'));
      if (!list.length) return '';
      const i = list[0].dataIndex;
      const rows = list
        .map((p: any) => {
          const k = ctx.series.findIndex((x) => `s-${x.field}` === p.seriesId);
          if (k < 0) return '';
          const raw = ctx.series[k].values[i];
          const sh = percent ? share(ctx, k, i) : null;
          const extra = sh !== null ? ` <span style="opacity:.7">(${formatPercentShare(sh, ctx.numberFormat.locale)})</span>` : '';
          return `<div style="display:flex;gap:12px;justify-content:space-between;align-items:center"><span>${p.marker}${esc(p.seriesName)}</span><b style="font-variant-numeric:tabular-nums">${esc(ctx.fmt(raw))}</b>${extra}</div>`;
        })
        .join('');
      return `<div style="font-weight:600;margin-bottom:4px">${esc(ctx.ds.categories[i] ?? '')}</div>${rows}`;
    },
  };
}

function itemTooltip(ctx: Ctx): any {
  return {
    trigger: 'item',
    formatter: (p: any) => {
      if (String(p.seriesId).startsWith('trend-')) return '';
      const k = ctx.series.findIndex((x) => `s-${x.field}` === p.seriesId);
      const i = p.dataIndex;
      if (k < 0) return '';
      const cat = ctx.ds.categories[i] ?? '';
      const raw = ctx.series[k].values[i];
      const head = ctx.series.length > 1 ? `${p.marker}${esc(ctx.series[k].name)}` : p.marker;
      return `<div style="font-weight:600">${esc(cat)}</div><div>${head} <b>${esc(ctx.fmt(raw))}</b></div>`;
    },
  };
}

function buildCartesian(ctx: Ctx): any {
  const { cfg, ds } = ctx;
  const type = cfg.type;
  const scatter = type === 'scatter';
  const numericX = scatter && ds.categoryValues.length > 0 && ds.categoryValues.every((x) => x !== null);
  const anyBar = type === 'bar' || type === 'lollipop' || (type === 'combo' && ctx.series.some((s, k) => seriesKind(ctx, s, k) === 'bar'));
  const percent = cfg.stack === 'percent' && ['bar', 'line', 'area', 'combo'].includes(type);

  let cat: any;
  if (numericX) {
    const xf = makeFormatter({ ...cfg.number, style: 'auto', prefix: '', suffix: '' }, ds.categoryValues as number[], { compactAuto: true });
    cat = {
      type: 'value',
      scale: true,
      name: cfg.catAxis.title || ds.categoryName,
      nameLocation: 'middle',
      nameGap: 32,
      nameTextStyle: { color: ctx.ink.text2, fontSize: Math.round(12 * ctx.s), fontWeight: 600, fontFamily: ctx.font },
      axisLine: { show: cfg.catAxis.show, lineStyle: { color: ctx.ink.axis } },
      axisTick: { show: false },
      axisLabel: { show: cfg.catAxis.show, color: ctx.ink.muted, fontSize: Math.round(11 * ctx.s), formatter: (v: number) => xf(v), hideOverlap: true },
      splitLine: { show: cfg.catAxis.grid, lineStyle: { color: ctx.ink.grid } },
    };
  } else {
    cat = categoryAxis(ctx, { boundaryGap: anyBar || scatter || ds.categories.length === 1 });
  }
  const val = valueAxis(ctx, { percent, scale: scatter });

  const series = ctx.series.flatMap((s, k) => buildCartesianSeries(ctx, s, k));
  const horizontal = ctx.horizontal;
  // Rótulo no fim da linha precisa de espaço à direita.
  const grid = gridFor(ctx.plot);
  if (ctx.labels.show && ctx.labels.which === 'last' && (type === 'line' || type === 'area')) {
    const longest = Math.max(0, ...ctx.series.map((s, k) => textWidth(labelText(ctx, k, s.values.length - 1), ctx.labels.size * ctx.s)));
    grid.right = ctx.plot.right + Math.min(160, longest + 12);
  }
  return {
    grid,
    xAxis: horizontal ? val : cat,
    yAxis: horizontal ? cat : val,
    series,
    tooltip: scatter || type === 'lollipop' ? itemTooltip(ctx) : axisTooltip(ctx),
  };
}

// ---------------------------------------------------------------------------
// Painéis pequenos (um gráfico por série)

function buildFacets(ctx: Ctx, title: any[]): any {
  const { cfg, ink } = ctx;
  const n = ctx.series.length;
  const width = ctx.env.width - ctx.plot.left - ctx.plot.right;
  const height = ctx.env.height - ctx.plot.top - ctx.plot.bottom;
  const cols = n <= 3 && width > 700 ? n : width < 520 ? 1 : Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const gapX = 28;
  const gapY = 20;
  const cellW = (width - gapX * (cols - 1)) / cols;
  const cellH = (height - gapY * (rows - 1)) / rows;
  const headH = Math.round(22 * ctx.s);
  const all = ctx.series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const sharedMax = cfg.facetSharedScale && all.length ? niceCeil(Math.max(0, ...all)) : undefined;
  const minAll = Math.min(0, ...all);
  const sharedMin = cfg.facetSharedScale && minAll < 0 ? -niceCeil(-minAll) : undefined;

  const grids: any[] = [];
  const xAxis: any[] = [];
  const yAxis: any[] = [];
  const series: any[] = [];
  ctx.series.forEach((s, k) => {
    const col = k % cols;
    const row = Math.floor(k / cols);
    const x = ctx.plot.left + col * (cellW + gapX);
    const y = ctx.plot.top + row * (cellH + gapY);
    title.push({
      text: s.name,
      left: x - 5,
      top: y - 5,
      textStyle: { fontSize: Math.round(13 * ctx.s), fontWeight: 600, color: ink.text, fontFamily: ctx.font },
    });
    grids.push({
      left: x,
      top: y + headH,
      width: cellW,
      height: cellH - headH,
      outerBoundsMode: 'same',
      outerBoundsContain: 'all',
    });
    const anyBar = seriesKind(ctx, s, k) === 'bar' || seriesKind(ctx, s, k) === 'lollipop';
    const cat = categoryAxis(ctx, { boundaryGap: anyBar, gridIndex: k, compact: true });
    if (!ctx.horizontal) {
      cat.axisLabel.width = Math.max(30, cellW / Math.max(1, ctx.ds.categories.length) - 4);
      cat.axisLabel.overflow = 'truncate';
    }
    const val = valueAxis(ctx, {
      gridIndex: k,
      compact: true,
      max: sharedMax,
      min: sharedMin,
      values: s.values.filter((v): v is number => v !== null),
    });
    val.splitNumber = 3;
    xAxis.push(ctx.horizontal ? val : cat);
    yAxis.push(ctx.horizontal ? cat : val);
    series.push(...buildCartesianSeries(ctx, s, k, { axisIndex: k, groupSize: 1, groupIndex: 0 }));
  });
  return { grid: grids, xAxis, yAxis, series, tooltip: itemTooltip(ctx) };
}

// ---------------------------------------------------------------------------
// Pizza e rosca

function buildPie(ctx: Ctx, graphic: any[]): any {
  const { cfg, ds, ink } = ctx;
  const s = ctx.series[0];
  if (!s) return { series: [] };
  const values = s.values;
  const negatives = values.some((v) => v !== null && v < 0);
  if (negatives) ctx.notes.push('Valores negativos não entram na pizza/rosca.');
  const total = values.reduce<number>((a, v) => a + (v !== null && v > 0 ? v : 0), 0);
  const labels = cfg.partLabels;
  const outside = labels.position !== 'inside' && labels.position !== 'center';
  const W = ctx.env.width - ctx.plot.left - ctx.plot.right;
  const H = ctx.env.height - ctx.plot.top - ctx.plot.bottom;
  const cx = ctx.plot.left + W / 2;
  const cy = ctx.plot.top + H / 2;
  const radius = Math.max(20, (Math.min(W * (outside ? 0.62 : 0.98), H * (outside ? 0.8 : 0.98)) / 2));
  const donut = cfg.type === 'donut';
  const inner = donut ? radius * Math.max(0.2, Math.min(0.85, cfg.innerRadius / 100)) : 0;
  const which = labelIndices(values, labels.which);

  if (donut && cfg.centerTotal) {
    const big = Math.round(Math.min(34, inner * 0.42) * ctx.s);
    graphic.push({
      type: 'text',
      x: cx,
      y: cy,
      silent: true,
      style: {
        text: `{v|${ctx.fmt(total)}}\n{l|Total}`,
        align: 'center',
        verticalAlign: 'middle',
        rich: {
          v: { fontSize: big, fontWeight: 650, fill: ink.text, fontFamily: ctx.font, lineHeight: big * 1.2 },
          l: { fontSize: Math.round(12 * ctx.s), fill: ink.muted, fontFamily: ctx.font, lineHeight: 16 },
        },
      },
    });
  }

  const data = values
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => v !== null && v > 0)
    .map(({ v, i }) => {
      const color = pointColor(ctx, ctx.pal[0], i, v, true);
      return {
        name: ds.categories[i],
        value: v,
        itemStyle: { color },
        label: { color: outside ? ink.text2 : textOn(color) },
        _i: i,
      };
    });

  return {
    series: [
      {
        id: `s-${s.field}`,
        name: s.name,
        type: 'pie',
        center: [cx, cy],
        radius: [inner, radius],
        roseType: cfg.rose ? 'radius' : undefined,
        startAngle: 90,
        padAngle: donut ? 1 : 0,
        avoidLabelOverlap: true,
        universalTransition: true,
        itemStyle: { borderColor: ctx.gap, borderWidth: donut ? 1 : 2, borderRadius: donut ? 4 : 0 },
        label: {
          show: true,
          position: outside ? 'outside' : 'inside',
          ...labelStyle(ctx, { fontSize: labels.size * ctx.s, fontWeight: labels.bold ? 600 : 400 }),
          formatter: (p: any) => {
            const i = data[p.dataIndex]?._i ?? 0;
            const name = esc(ds.categories[i] ?? '').replace(/[{}|]/g, '');
            if (!labels.show || !which.has(i)) return name;
            const sh = total ? (values[i] ?? 0) / total : 0;
            const pct = formatPercentShare(sh, ctx.numberFormat.locale);
            const val = ctx.fmt(values[i]);
            const content = labels.content;
            const detail =
              content === 'percent' ? pct : content === 'value+percent' ? `${val} (${pct})` : content === 'category' ? '' : val;
            return detail ? `${name}\n{d|${detail}}` : name;
          },
          rich: {
            d: {
              fontSize: labels.size * ctx.s,
              fontWeight: 650,
              fontFamily: ctx.font,
              lineHeight: labels.size * ctx.s * 1.4,
            },
          },
          lineHeight: labels.size * ctx.s * 1.3,
        },
        labelLine: { show: outside, length: 12, length2: 10, lineStyle: { color: ink.axis } },
        labelLayout: { hideOverlap: true },
        data: data.map(({ _i, ...rest }) => rest),
      },
    ],
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        const sh = total ? p.value / total : 0;
        return `<div style="font-weight:600">${esc(p.name)}</div><div>${p.marker}<b>${esc(ctx.fmt(p.value))}</b> · ${formatPercentShare(sh, ctx.numberFormat.locale)}</div>`;
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Radar

function buildRadar(ctx: Ctx): any {
  const { cfg, ds, ink } = ctx;
  const all = ctx.series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const max = niceCeil(Math.max(1, ...all));
  const min = Math.min(0, ...all);
  if (ds.categories.length > 24) ctx.notes.push('Muitas categorias deixam o radar ilegível; considere filtrar ou usar Top N.');
  const W = ctx.env.width - ctx.plot.left - ctx.plot.right;
  const H = ctx.env.height - ctx.plot.top - ctx.plot.bottom;
  const radius = Math.max(30, Math.min(W * 0.62, H * 0.82) / 2);
  return {
    radar: {
      center: [ctx.plot.left + W / 2, ctx.plot.top + H / 2],
      radius,
      indicator: ds.categories.map((name) => ({ name, max, min })),
      axisName: { color: ink.text2, fontSize: Math.round(12 * ctx.s), fontFamily: ctx.font },
      splitLine: { lineStyle: { color: ink.grid } },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: ink.grid } },
      splitNumber: 4,
    },
    series: [
      {
        id: 'radar',
        type: 'radar',
        symbol: 'circle',
        symbolSize: cfg.symbols ? cfg.symbolSize : 0,
        emphasis: { focus: 'self' },
        data: ctx.series.map((s, k) => {
          const color = seriesColor(ctx, s, k);
          return {
            name: s.name,
            value: s.values.map((v) => missing(v)),
            itemStyle: { color, borderColor: ctx.gap, borderWidth: 2 },
            lineStyle: { color, width: cfg.lineWidth, type: cfg.seriesStyle[s.name]?.dashed ? [8, 5] : 'solid' },
            areaStyle: { color, opacity: cfg.areaOpacity },
            label: {
              show: ctx.labels.show,
              ...labelStyle(ctx),
              formatter: (p: any) => ctx.fmt(typeof p.value === 'number' ? p.value : null),
            },
          };
        }),
      },
    ],
    tooltip: { trigger: 'item', valueFormatter: (v: any) => ctx.fmt(typeof v === 'number' ? v : null) },
  };
}

// ---------------------------------------------------------------------------
// Funil

function buildFunnel(ctx: Ctx): any {
  const { cfg, ds, ink } = ctx;
  const s = ctx.series[0];
  if (!s) return { series: [] };
  const labels = cfg.partLabels;
  const inside = labels.position !== 'outside';
  const total = s.values[0] ?? 0;
  const ordinal = shades(ctx.pal[0], ds.categories.length, ctx.dark);
  const W = ctx.env.width - ctx.plot.left - ctx.plot.right;
  return {
    series: [
      {
        id: `s-${s.field}`,
        name: s.name,
        type: 'funnel',
        sort: 'none',
        orient: ctx.horizontal ? 'horizontal' : 'vertical',
        top: ctx.plot.top,
        bottom: ctx.plot.bottom,
        left: ctx.plot.left,
        right: ctx.plot.right + (inside || ctx.horizontal ? 0 : W * 0.3),
        gap: 2,
        minSize: '8%',
        itemStyle: { borderColor: ctx.gap, borderWidth: 0 },
        label: {
          show: true,
          position: inside ? 'inside' : ctx.horizontal ? 'bottom' : 'right',
          ...labelStyle(ctx, { fontSize: labels.size * ctx.s, fontWeight: labels.bold ? 600 : 400 }),
          formatter: (p: any) => {
            const i = p.dataIndex;
            const v = s.values[i];
            if (!labels.show) return ds.categories[i];
            const pct = total ? formatPercentShare((v ?? 0) / total, ctx.numberFormat.locale) : '';
            const val = ctx.fmt(v);
            const detail = labels.content === 'percent' ? pct : labels.content === 'value+percent' ? `${val} (${pct})` : labels.content === 'category' ? '' : val;
            return detail ? `${ds.categories[i]}: ${detail}` : ds.categories[i];
          },
        },
        labelLine: { show: !inside, lineStyle: { color: ink.axis } },
        data: s.values.map((v, i) => {
          const base = cfg.colorMode === 'palette' && !cfg.varyColors ? ordinal[i] : pointColor(ctx, ctx.pal[0], i, v, true);
          const color = cfg.colorMode === 'palette' && cfg.categoryColors[ds.categories[i]] ? cfg.categoryColors[ds.categories[i]] : base;
          return { name: ds.categories[i], value: missing(v), itemStyle: { color }, label: { color: inside ? textOn(color) : ink.text2 } };
        }),
      },
    ],
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        const pct = total ? formatPercentShare((s.values[p.dataIndex] ?? 0) / total, ctx.numberFormat.locale) : '';
        return `<div style="font-weight:600">${esc(p.name)}</div><div>${p.marker}<b>${esc(ctx.fmt(s.values[p.dataIndex]))}</b>${pct ? ` · ${pct} do início` : ''}</div>`;
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Mosaico (treemap)

function buildTreemap(ctx: Ctx): any {
  const { cfg, ds } = ctx;
  const s = ctx.series[0];
  if (!s) return { series: [] };
  if (s.values.some((v) => v !== null && v < 0)) ctx.notes.push('Valores negativos não entram no mosaico.');
  const total = s.values.reduce<number>((a, v) => a + (v !== null && v > 0 ? v : 0), 0);
  const labels = cfg.partLabels;
  const data = s.values
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => v !== null && v > 0)
    .map(({ v, i }) => {
      const color = pointColor(ctx, ctx.pal[0], i, v, true);
      const pct = total ? formatPercentShare((v as number) / total, ctx.numberFormat.locale) : '';
      const val = ctx.fmt(v);
      const detail = !labels.show
        ? ''
        : labels.content === 'percent'
          ? pct
          : labels.content === 'value+percent'
            ? `${val} (${pct})`
            : labels.content === 'category'
              ? ''
              : val;
      const name = (ds.categories[i] ?? '').replace(/[{}|]/g, '');
      return {
        name: ds.categories[i],
        value: v,
        itemStyle: { color },
        label: {
          color: textOn(color),
          formatter: detail ? `{n|${name}}\n{d|${detail}}` : `{n|${name}}`,
        },
      };
    });
  return {
    series: [
      {
        id: `s-${s.field}`,
        name: s.name,
        type: 'treemap',
        top: ctx.plot.top,
        bottom: ctx.plot.bottom,
        left: ctx.plot.left,
        right: ctx.plot.right,
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        squareRatio: 0.5 * (1 + Math.sqrt(5)),
        itemStyle: { borderColor: ctx.gap, borderWidth: 2, gapWidth: 2, borderRadius: 3 },
        label: {
          show: true,
          position: 'insideTopLeft',
          padding: 6,
          overflow: 'truncate',
          rich: {
            n: { fontSize: labels.size * ctx.s, fontWeight: labels.bold ? 650 : 500, fontFamily: ctx.font, lineHeight: labels.size * ctx.s * 1.35 },
            d: { fontSize: labels.size * ctx.s * 1.05, fontWeight: 650, fontFamily: ctx.font, lineHeight: labels.size * ctx.s * 1.45 },
          },
        },
        upperLabel: { show: false },
        data,
      },
    ],
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        const pct = total ? formatPercentShare(p.value / total, ctx.numberFormat.locale) : '';
        return `<div style="font-weight:600">${esc(p.name)}</div><div>${p.marker}<b>${esc(ctx.fmt(p.value))}</b> · ${pct}</div>`;
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Mapa de calor

function buildHeatmap(ctx: Ctx): any {
  const { cfg, ds, ink } = ctx;
  const ramp = getRamp(cfg.ramp);
  const lo = ctx.dark ? mix(ramp.to, ink.surface, 0.35) : ramp.from;
  const hi = ctx.dark ? ramp.from : ramp.to;
  const data: any[] = [];
  ctx.series.forEach((s, k) =>
    s.values.forEach((v, i) => {
      if (v === null) return;
      const color = rampColor(ctx, v);
      data.push({ value: [i, k, v], label: { color: textOn(color) } });
    }),
  );
  const plot = { ...ctx.plot, bottom: ctx.plot.bottom + 44 };
  const cat = categoryAxis({ ...ctx, horizontal: false, plot }, { boundaryGap: true });
  cat.splitArea = { show: false };
  cat.axisLine = { show: false };
  const rows = {
    type: 'category',
    data: ctx.series.map((s) => s.name),
    inverse: true,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: ink.text2, fontSize: Math.round(12 * ctx.s), fontFamily: ctx.font, width: 180, overflow: 'truncate' },
    name: cfg.valAxis.title,
    nameLocation: 'middle',
    nameGap: 60,
  };
  return {
    grid: gridFor(plot),
    xAxis: cat,
    yAxis: rows,
    visualMap: {
      type: 'continuous',
      min: ctx.vmin,
      max: ctx.vmax === ctx.vmin ? ctx.vmin + 1 : ctx.vmax,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: ctx.plot.bottom,
      itemHeight: Math.min(260, ctx.env.width * 0.4),
      itemWidth: 12,
      text: [ctx.fmt(ctx.vmax), ctx.fmt(ctx.vmin)],
      textGap: 8,
      textStyle: { color: ink.text2, fontSize: Math.round(11 * ctx.s), fontFamily: ctx.font },
      inRange: { color: [mix(lo, hi, 0.15), hi] },
    },
    series: [
      {
        id: 'heatmap',
        type: 'heatmap',
        data,
        itemStyle: { borderColor: ctx.gap, borderWidth: 2, borderRadius: 3 },
        label: {
          show: ctx.labels.show,
          ...labelStyle(ctx),
          formatter: (p: any) => ctx.fmt(p.value[2]),
        },
        emphasis: { itemStyle: { borderColor: ink.text, borderWidth: 1 } },
      },
    ],
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        const [i, k, v] = p.value;
        return `<div style="font-weight:600">${esc(ds.categories[i] ?? '')}</div><div>${esc(ctx.series[k]?.name ?? '')}: <b>${esc(ctx.fmt(v))}</b></div>`;
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Cascata

function buildWaterfall(ctx: Ctx): any {
  const { cfg, ds, ink } = ctx;
  const s = ctx.series[0];
  if (!s) return { series: [] };
  const rows: { cat: string; start: number; end: number; delta: number; kind: 0 | 1 | 2 }[] = [];
  let cum = 0;
  s.values.forEach((v, i) => {
    const d = v ?? 0;
    rows.push({ cat: ds.categories[i], start: cum, end: cum + d, delta: d, kind: d >= 0 ? 0 : 1 });
    cum += d;
  });
  if (cfg.waterfallTotal) rows.push({ cat: 'Total', start: 0, end: cum, delta: cum, kind: 2 });
  const cats = rows.map((r) => r.cat);
  const none = cfg.colorMode === 'none';
  const single = cfg.colorMode === 'single';
  const totalColor = cfg.totalColor === '#52514e' && ctx.dark ? ink.text2 : cfg.totalColor;
  const colors = none
    ? [GRAYS_LIGHT[1], GRAYS_LIGHT[2], GRAYS_LIGHT[0]]
    : single
      ? [cfg.singleColor, mix(cfg.singleColor, ctx.gap, 0.45), mix(cfg.singleColor, ink.text, 0.35)]
      : [cfg.posColor, cfg.negColor, totalColor];
  const dsWf = { ...ctx.ds, categories: cats };
  const cat = categoryAxis({ ...ctx, ds: dsWf }, { boundaryGap: true });
  const vals = rows.flatMap((r) => [r.start, r.end]);
  const val = valueAxis(ctx, { values: vals.filter((v) => v > 0).length === vals.length ? vals : [] });
  const showLabels = ctx.labels.show;
  const signed = (d: number, kind: number) => (kind === 2 ? ctx.fmt(d) : `${d > 0 ? '+' : ''}${ctx.fmt(d)}`);

  return {
    grid: gridFor(ctx.plot),
    xAxis: ctx.horizontal ? val : cat,
    yAxis: ctx.horizontal ? cat : val,
    series: [
      {
        id: `s-${s.field}`,
        name: s.name,
        type: 'custom',
        encode: ctx.horizontal ? { y: 0, x: [1, 2] } : { x: 0, y: [1, 2] },
        data: rows.map((r, i) => [i, r.start, r.end, r.delta, r.kind]),
        renderItem: (_params: any, api: any) => {
          const i = api.value(0);
          const start = api.value(1);
          const end = api.value(2);
          const delta = api.value(3);
          const kind = api.value(4);
          const band = ctx.horizontal ? api.size([0, 1])[1] : api.size([1, 0])[0];
          const w = band * (cfg.barWidth / 100);
          const p1 = api.coord(ctx.horizontal ? [start, i] : [i, start]);
          const p2 = api.coord(ctx.horizontal ? [end, i] : [i, end]);
          const color = colors[kind];
          const children: any[] = [];
          const r = Math.min(cfg.barRadius, w / 2);
          if (ctx.horizontal) {
            const x = Math.min(p1[0], p2[0]);
            children.push({
              type: 'rect',
              shape: { x, y: p1[1] - w / 2, width: Math.max(1, Math.abs(p2[0] - p1[0])), height: w, r },
              style: { fill: color },
            });
          } else {
            const y = Math.min(p1[1], p2[1]);
            children.push({
              type: 'rect',
              shape: { x: p1[0] - w / 2, y, width: w, height: Math.max(1, Math.abs(p2[1] - p1[1])), r },
              style: { fill: color },
            });
          }
          // Conector até a próxima barra.
          if (i < rows.length - 1) {
            const next = rows[i + 1];
            const joinsTotal = next.kind === 2;
            if (!joinsTotal || Math.abs(next.end - end) < 1e-9) {
              if (ctx.horizontal) {
                children.push({
                  type: 'line',
                  shape: { x1: p2[0], y1: p1[1] + w / 2, x2: p2[0], y2: p1[1] + band - w / 2 },
                  style: { stroke: ink.axis, lineWidth: 1 },
                });
              } else {
                children.push({
                  type: 'line',
                  shape: { x1: p1[0] + w / 2, y1: p2[1], x2: p1[0] + band - w / 2, y2: p2[1] },
                  style: { stroke: ink.axis, lineWidth: 1 },
                });
              }
            }
          }
          if (showLabels) {
            const up = end >= start;
            const text = signed(delta, kind);
            const font = `${ctx.labels.bold || kind === 2 ? 650 : 400} ${Math.round(ctx.labels.size * ctx.s)}px ${ctx.font}`;
            if (ctx.horizontal) {
              const edge = up ? Math.max(p1[0], p2[0]) : Math.min(p1[0], p2[0]);
              children.push({
                type: 'text',
                x: edge + (up ? 6 : -6),
                y: p1[1],
                style: { text, fill: ink.text2, font, align: up ? 'left' : 'right', verticalAlign: 'middle' },
              });
            } else {
              const edge = up ? Math.min(p1[1], p2[1]) : Math.max(p1[1], p2[1]);
              children.push({
                type: 'text',
                x: p1[0],
                y: edge + (up ? -6 : 6),
                style: { text, fill: ink.text2, font, align: 'center', verticalAlign: up ? 'bottom' : 'top' },
              });
            }
          }
          return { type: 'group', children };
        },
      },
      // Séries vazias só para a legenda explicar as cores.
      { name: 'Aumento', type: 'bar', data: [], itemStyle: { color: colors[0] } },
      { name: 'Redução', type: 'bar', data: [], itemStyle: { color: colors[1] } },
      ...(cfg.waterfallTotal ? [{ name: 'Total', type: 'bar', data: [], itemStyle: { color: colors[2] } }] : []),
    ],
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        const r = rows[p.dataIndex];
        if (!r) return '';
        const body = r.kind === 2 ? `Total: <b>${esc(ctx.fmt(r.end))}</b>` : `Variação: <b>${esc(signed(r.delta, r.kind))}</b><br/>Acumulado: ${esc(ctx.fmt(r.end))}`;
        return `<div style="font-weight:600">${esc(r.cat)}</div><div>${body}</div>`;
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Halteres

function buildDumbbell(ctx: Ctx): any {
  const { cfg, ds, ink } = ctx;
  const ranges = ds.categories.map((_, i) => {
    const vals = ctx.series.map((s) => s.values[i]).filter((v): v is number => v !== null);
    return vals.length ? [Math.min(...vals), Math.max(...vals)] : null;
  });
  const cat = categoryAxis(ctx, { boundaryGap: true });
  cat.splitLine = { show: true, lineStyle: { color: ink.grid, width: 1 } };
  const val = valueAxis(ctx, { scale: true });
  const size = Math.max(10, cfg.symbolSize + 4);
  const first = ctx.series[0];
  const last = ctx.series[ctx.series.length - 1];

  const series: any[] = [
    {
      id: 'dumbbell-range',
      name: 'Diferença',
      type: 'custom',
      silent: true,
      z: 1,
      encode: ctx.horizontal ? { y: 0, x: [1, 2] } : { x: 0, y: [1, 2] },
      data: ranges.map((r, i) => (r ? [i, r[0], r[1]] : [i, '-', '-'])),
      renderItem: (_params: any, api: any) => {
        const i = api.value(0);
        const a = api.value(1);
        const b = api.value(2);
        if (Number.isNaN(a) || a === '-') return null;
        const p1 = api.coord(ctx.horizontal ? [a, i] : [i, a]);
        const p2 = api.coord(ctx.horizontal ? [b, i] : [i, b]);
        return {
          type: 'line',
          shape: { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1] },
          style: { stroke: ink.faded, lineWidth: Math.max(3, cfg.lineWidth + 2), lineCap: 'round' },
        };
      },
    },
  ];
  ctx.series.forEach((s, k) => {
    const color = seriesColor(ctx, s, k);
    const which = labelIndices(s.values, ctx.labels.which);
    series.push({
      id: `s-${s.field}`,
      name: s.name,
      type: 'scatter',
      z: 3,
      symbolSize: size,
      itemStyle: { color, borderColor: ctx.gap, borderWidth: 2, opacity: 1 },
      label: {
        show: ctx.labels.show,
        ...labelStyle(ctx),
        formatter: (p: any) => (which.has(p.dataIndex) ? labelText(ctx, k, p.dataIndex, ctx.labels.content === 'percent' ? 'value' : ctx.labels.content) : ''),
      },
      data: s.values.map((v, i) => {
        const r = ranges[i];
        const isMin = r && v !== null && v === r[0] && r[0] !== r[1];
        const position = ctx.horizontal ? (isMin ? 'left' : 'right') : isMin ? 'bottom' : 'top';
        const c = pointColor(ctx, color, i, v, false);
        return {
          value: ctx.horizontal ? [missing(v), i] : [i, missing(v)],
          itemStyle: c === color ? undefined : { color: c },
          label: { position, distance: 6 },
        };
      }),
    });
  });
  return {
    grid: gridFor(ctx.plot),
    xAxis: ctx.horizontal ? val : cat,
    yAxis: ctx.horizontal ? cat : val,
    series,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: ctx.dark ? 'rgba(255,255,255,0.05)' : 'rgba(11,11,11,0.04)' } },
      formatter: (params: any) => {
        const list = Array.isArray(params) ? params : [params];
        const i = list[0]?.dataIndex ?? 0;
        const rowsHtml = ctx.series
          .map((s) => `<div>${list.find((p: any) => p.seriesId === `s-${s.field}`)?.marker ?? ''}${esc(s.name)}: <b>${esc(ctx.fmt(s.values[i]))}</b></div>`)
          .join('');
        let diff = '';
        if (first && last && first !== last && first.values[i] !== null && last.values[i] !== null) {
          const d = (last.values[i] as number) - (first.values[i] as number);
          diff = `<div style="opacity:.75;margin-top:2px">Diferença: ${d > 0 ? '+' : ''}${esc(ctx.fmt(d))}</div>`;
        }
        return `<div style="font-weight:600;margin-bottom:2px">${esc(ds.categories[i] ?? '')}</div>${rowsHtml}${diff}`;
      },
    },
  };
}
