import { DEFAULT_DATA_SETTINGS } from './data/dataset';
import { detectHint, parsePastedText } from './data/parseText';
import { SAMPLES } from './data/samples';
import type { DataSettings, Workbook } from './data/types';
import { CHART_GALLERY, DEFAULT_CONFIG, type ChartConfig } from './chart/config';

export interface AppState {
  workbook: Workbook;
  data: DataSettings;
  chart: ChartConfig;
  /** Os dados atuais são um exemplo (mostra o aviso). */
  isSample: boolean;
}

export function sampleWorkbook(id: string): Workbook {
  const sample = SAMPLES.find((s) => s.id === id) ?? SAMPLES[0];
  const grid = parsePastedText(sample.tsv);
  return { source: `Exemplo: ${sample.name}`, sheets: [{ name: sample.name, grid, hint: detectHint(grid) }] };
}

export function sampleState(id: string, chart: ChartConfig = DEFAULT_CONFIG): AppState {
  const sample = SAMPLES.find((s) => s.id === id) ?? SAMPLES[0];
  const item = CHART_GALLERY.find((g) => g.id === sample.chart) ?? CHART_GALLERY[0];
  return {
    workbook: sampleWorkbook(sample.id),
    data: { ...DEFAULT_DATA_SETTINGS },
    chart: {
      ...chart,
      type: item.type,
      horizontal: item.horizontal ?? (sample.chart === 'dumbbell' ? true : chart.horizontal),
      title: sample.name,
      subtitle: 'Dados de exemplo',
      source: '',
      seriesStyle: {},
      categoryColors: {},
      highlight: [],
      labels: { ...chart.labels, show: ['waterfall', 'dumbbell'].includes(sample.chart) ? true : chart.labels.show },
    },
    isSample: true,
  };
}

export const INITIAL_STATE: AppState = sampleState('vendas');

// ---------------------------------------------------------------------------
// Histórico (desfazer / refazer)

export interface History {
  past: AppState[];
  present: AppState;
  future: AppState[];
  lastKey: string | null;
  lastTime: number;
}

export type Action =
  | { type: 'set'; update: (s: AppState) => AppState; key?: string }
  | { type: 'undo' }
  | { type: 'redo' };

const LIMIT = 120;
const COALESCE_MS = 900;

export function historyReducer(h: History, action: Action): History {
  switch (action.type) {
    case 'undo': {
      if (!h.past.length) return h;
      const prev = h.past[h.past.length - 1];
      return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future], lastKey: null, lastTime: 0 };
    }
    case 'redo': {
      if (!h.future.length) return h;
      const [next, ...rest] = h.future;
      return { past: [...h.past, h.present], present: next, future: rest, lastKey: null, lastTime: 0 };
    }
    case 'set': {
      const next = action.update(h.present);
      if (next === h.present) return h;
      const now = Date.now();
      // Arrastar um controle deslizante ou digitar um título vira um passo só no histórico.
      if (action.key && action.key === h.lastKey && now - h.lastTime < COALESCE_MS) {
        return { ...h, present: next, future: [], lastTime: now };
      }
      return {
        past: [...h.past, h.present].slice(-LIMIT),
        present: next,
        future: [],
        lastKey: action.key ?? null,
        lastTime: now,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Salvamento automático no navegador

const STORAGE_KEY = 'criador-de-graficos:v1';
const MAX_SAVED_CHARS = 2_500_000;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Junta uma configuração salva com os padrões (campos novos ganham o valor padrão). */
export function mergeConfig(saved: unknown): ChartConfig {
  if (!isObject(saved)) return DEFAULT_CONFIG;
  const out: Record<string, unknown> = { ...DEFAULT_CONFIG };
  for (const [k, v] of Object.entries(saved)) {
    if (!(k in DEFAULT_CONFIG)) continue;
    const def = (DEFAULT_CONFIG as unknown as Record<string, unknown>)[k];
    if (isObject(def) && isObject(v) && !['seriesStyle', 'categoryColors'].includes(k)) out[k] = { ...def, ...v };
    else if (typeof def === typeof v || def === null || v === null) out[k] = v;
  }
  return out as unknown as ChartConfig;
}

export function loadSaved(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isObject(parsed) || !isObject(parsed.workbook) || !Array.isArray((parsed.workbook as { sheets?: unknown }).sheets)) return null;
    const workbook = parsed.workbook as unknown as Workbook;
    if (!workbook.sheets.length) return null;
    return {
      workbook,
      data: { ...DEFAULT_DATA_SETTINGS, ...(isObject(parsed.data) ? parsed.data : {}) } as DataSettings,
      chart: mergeConfig(parsed.chart),
      isSample: Boolean(parsed.isSample),
    };
  } catch {
    return null;
  }
}

export function saveState(state: AppState): void {
  try {
    let raw = JSON.stringify(state);
    if (raw.length > MAX_SAVED_CHARS) {
      // Planilhas muito grandes: guarda só o estilo.
      raw = JSON.stringify({ ...state, workbook: sampleWorkbook('vendas'), isSample: true });
    }
    localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    /* armazenamento indisponível: segue sem salvar */
  }
}

// ---------------------------------------------------------------------------
// Estilos salvos (modelos)

const TEMPLATES_KEY = 'criador-de-graficos:modelos';

export interface Template {
  name: string;
  chart: Partial<ChartConfig>;
}

/** O que um modelo NÃO leva: coisas que só fazem sentido para uma tabela específica. */
export function styleOnly(c: ChartConfig): Partial<ChartConfig> {
  const copy: Partial<ChartConfig> = { ...c };
  for (const k of ['title', 'subtitle', 'source', 'highlight', 'categoryColors', 'seriesStyle'] as const) delete copy[k];
  return copy;
}

export function loadTemplates(): Template[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((t) => isObject(t) && typeof t.name === 'string') : [];
  } catch {
    return [];
  }
}

export function saveTemplates(list: Template[]): void {
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list));
  } catch {
    /* sem armazenamento */
  }
}

export function applyTemplate(current: ChartConfig, tpl: Partial<ChartConfig>): ChartConfig {
  const merged = mergeConfig({ ...current, ...tpl });
  return {
    ...merged,
    title: current.title,
    subtitle: current.subtitle,
    source: current.source,
    highlight: current.highlight,
    categoryColors: current.categoryColors,
    seriesStyle: current.seriesStyle,
  };
}
