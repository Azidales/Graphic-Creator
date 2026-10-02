import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { CHART_GALLERY, type ChartConfig, type ChartTypeInfo } from './chart/config';
import { getPalette } from './chart/palettes';
import { buildDataset, DEFAULT_DATA_SETTINGS, prepare } from './data/dataset';
import { detectHint, parsePastedText, tidyGrid } from './data/parseText';
import { readFile } from './data/readWorkbook';
import type { DataSettings, Grid, Workbook } from './data/types';
import { prepareDownloads, type LogicalSize } from './export';
import { historyReducer, INITIAL_STATE, loadSaved, saveState, sampleState, type AppState } from './state';
import { ChartView } from './ui/ChartView';
import { DataGrid } from './ui/DataGrid';
import { DataPanel } from './ui/DataPanel';
import { ExportPanel } from './ui/ExportPanel';
import { Gallery } from './ui/Gallery';
import { Icon } from './ui/icons';
import { LabelsPanel } from './ui/LabelsPanel';
import { VisualPanel } from './ui/VisualPanel';

type Tab = 'dados' | 'visual' | 'rotulos' | 'exportar';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dados', label: 'Dados' },
  { id: 'visual', label: 'Visual' },
  { id: 'rotulos', label: 'Rótulos e eixos' },
  { id: 'exportar', label: 'Exportar' },
];

function useDarkMode(): boolean {
  const read = () => {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'dark') return true;
    if (attr === 'light') return false;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  };
  const [dark, setDark] = useState(read);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const update = () => setDark(read());
    mq?.addEventListener('change', update);
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq?.removeEventListener('change', update);
      mo.disconnect();
    };
  }, []);
  return dark;
}

/** Tabelas copiadas de páginas web às vezes só vêm como HTML. */
function gridFromHtml(html: string): Grid | null {
  if (!/<table/i.test(html)) return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return null;
  const grid: Grid = Array.from(table.querySelectorAll('tr')).map((tr) =>
    Array.from(tr.querySelectorAll('th,td')).map((td) => (td.textContent ?? '').replace(/\s+/g, ' ').trim() || null),
  );
  const tidy = tidyGrid(grid);
  return tidy.length ? tidy : null;
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
}

export function App() {
  const [history, dispatch] = useReducer(historyReducer, undefined, () => ({
    past: [],
    present: loadSaved() ?? INITIAL_STATE,
    future: [],
    lastKey: null,
    lastTime: 0,
  }));
  const state = history.present;
  const [tab, setTab] = useState<Tab>('dados');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [gridOpen, setGridOpen] = useState(true);
  const sizeRef = useRef<LogicalSize>({ width: 800, height: 480 });
  const [size, setSize] = useState<LogicalSize>(sizeRef.current);
  const uiDark = useDarkMode();
  const toastTimer = useRef<number | undefined>(undefined);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 3200);
  }, []);

  const update = useCallback((fn: (s: AppState) => AppState, key?: string) => dispatch({ type: 'set', update: fn, key }), []);
  const setData = useCallback(
    (patch: Partial<DataSettings>, key?: string) => update((s) => ({ ...s, data: { ...s.data, ...patch } }), key),
    [update],
  );
  const setChart = useCallback(
    (patch: Partial<ChartConfig> | ((c: ChartConfig) => Partial<ChartConfig>), key?: string) =>
      update((s) => ({ ...s, chart: { ...s.chart, ...(typeof patch === 'function' ? patch(s.chart) : patch) } }), key),
    [update],
  );

  const loadWorkbook = useCallback(
    (workbook: Workbook) => {
      update((s) => ({
        workbook,
        data: { ...DEFAULT_DATA_SETTINGS },
        chart: {
          ...s.chart,
          title: s.isSample ? '' : s.chart.title,
          subtitle: s.isSample ? '' : s.chart.subtitle,
          seriesStyle: {},
          categoryColors: {},
          highlight: [],
        },
        isSample: false,
      }));
      const sheets = workbook.sheets.length;
      toast(sheets > 1 ? `${workbook.source}: ${sheets} planilhas. Escolha a aba em Dados.` : `Dados carregados: ${workbook.source}`);
    },
    [update, toast],
  );

  const loadGrid = useCallback(
    (grid: Grid, source: string) => {
      if (!grid.length) {
        toast('Não encontrei uma tabela no que foi colado.');
        return;
      }
      loadWorkbook({ source, sheets: [{ name: source, grid, hint: detectHint(grid) }] });
    },
    [loadWorkbook, toast],
  );

  const onText = useCallback((text: string, source = 'Colado') => loadGrid(parsePastedText(text), source), [loadGrid]);

  const onFile = useCallback(
    async (file: File) => {
      try {
        loadWorkbook(await readFile(file));
      } catch (e) {
        toast(e instanceof Error && e.message ? `Não consegui ler ${file.name}: ${e.message}` : `Não consegui ler ${file.name}.`);
      }
    },
    [loadWorkbook, toast],
  );

  const onSample = useCallback(
    (id: string) => {
      update((s) => sampleState(id, s.chart));
      toast('Exemplo carregado');
    },
    [update, toast],
  );

  // Colar em qualquer lugar da página e atalhos de teclado.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const text = e.clipboardData?.getData('text/plain') ?? '';
      const html = e.clipboardData?.getData('text/html') ?? '';
      if (text.includes('\t') || text.includes('\n') || text.includes(';')) {
        e.preventDefault();
        onText(text, 'Colado');
        return;
      }
      const fromHtml = html ? gridFromHtml(html) : null;
      if (fromHtml) {
        e.preventDefault();
        loadGrid(fromHtml, 'Colado');
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'undo' });
      } else if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) {
        e.preventDefault();
        dispatch({ type: 'redo' });
      }
    };
    window.addEventListener('paste', onPaste);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('keydown', onKey);
    };
  }, [onText, loadGrid]);

  // Arrastar e soltar arquivo.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) onFile(f);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, [onFile]);

  // Salva no navegador (sem travar a digitação).
  useEffect(() => {
    const t = window.setTimeout(() => saveState(state), 500);
    return () => window.clearTimeout(t);
  }, [state]);

  useEffect(() => prepareDownloads(), []);

  const sheet = state.workbook.sheets[state.data.sheetIndex] ?? state.workbook.sheets[0];
  const dataset = useMemo(
    () => buildDataset(sheet?.grid ?? [], state.data, sheet?.hint ?? null),
    [sheet, state.data],
  );

  // Cascata e mapa de calor ligam os rótulos; ao sair deles, os rótulos voltam ao que eram.
  const labelsBefore = useRef<boolean | null>(null);
  const pickType = (item: ChartTypeInfo) => {
    setChart((c) => {
      const patch: Partial<ChartConfig> = { type: item.type };
      if (item.type !== c.type || item.horizontal !== undefined) {
        patch.horizontal = item.horizontal ?? item.type === 'dumbbell';
      }
      const valueTypes = ['waterfall', 'heatmap'];
      const entering = valueTypes.includes(item.type) && !valueTypes.includes(c.type);
      const leaving = !valueTypes.includes(item.type) && valueTypes.includes(c.type);
      if (entering) {
        labelsBefore.current = c.labels.show;
        patch.labels = { ...c.labels, show: true };
      } else if (leaving && labelsBefore.current !== null) {
        patch.labels = { ...c.labels, show: labelsBefore.current };
        labelsBefore.current = null;
      }
      return patch;
    });
  };

  const palette = getPalette(state.chart.palette)[uiDark ? 'dark' : 'light'];
  const colorOf = (field: number) => {
    const s = dataset.series.find((x) => x.field === field);
    if (!s) return null;
    return state.chart.seriesStyle[s.name]?.color ?? palette[s.colorSlot % palette.length];
  };

  const onFieldClick = (field: number) => {
    const info = dataset.fields[field];
    if (!info) return;
    if (field === dataset.categoryField) return;
    if (!info.numeric) {
      setData({ categoryField: field, seriesFields: null });
      return;
    }
    const prep = prepare(sheet?.grid ?? [], state.data);
    const numeric = prep.fields.filter((f) => f.numeric && f.index !== dataset.categoryField).map((f) => f.index);
    const current = state.data.seriesFields ?? numeric;
    const on = current.includes(field);
    setData({ seriesFields: (on ? current.filter((f) => f !== field) : [...current, field]).sort((a, b) => a - b) });
  };

  const onEdit = (r: number, c: number, value: string) => {
    update((s) => {
      const idx = s.workbook.sheets[s.data.sheetIndex] ? s.data.sheetIndex : 0;
      const sheets = s.workbook.sheets.map((sh, i) => {
        if (i !== idx) return sh;
        const grid = sh.grid.map((row) => row.slice());
        while (grid[r].length <= c) grid[r].push(null);
        grid[r][c] = value.trim() === '' ? null : value;
        return { ...sh, grid };
      });
      return { ...s, workbook: { ...s.workbook, sheets } };
    });
  };

  const handleSize = useCallback((s: LogicalSize) => {
    sizeRef.current = s;
    setSize(s);
  }, []);

  const typeName = CHART_GALLERY.find((g) => g.type === state.chart.type && (g.horizontal === undefined || g.horizontal === state.chart.horizontal))?.name;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>Criador de Gráficos</h1>
          <span className="cellref" title="Tipo de gráfico atual">
            {typeName ?? ''} · {dataset.series.length} série{dataset.series.length === 1 ? '' : 's'} × {dataset.categories.length}
          </span>
        </div>
        <span className="spacer" />
        <div className="toolbar">
          <button type="button" className="btn icon ghost" aria-label="Desfazer (Ctrl+Z)" title="Desfazer (Ctrl+Z)" disabled={!history.past.length} onClick={() => dispatch({ type: 'undo' })}>
            {Icon.undo}
          </button>
          <button type="button" className="btn icon ghost" aria-label="Refazer (Ctrl+Y)" title="Refazer (Ctrl+Y)" disabled={!history.future.length} onClick={() => dispatch({ type: 'redo' })}>
            {Icon.redo}
          </button>
          <button type="button" className="btn primary" onClick={() => setTab('exportar')}>
            {Icon.download}
            Exportar
          </button>
        </div>
      </header>

      <main className="main">
        {state.isSample ? (
          <div className="sample-banner" role="status">
            <span>
              <strong>Você está vendo dados de exemplo.</strong> Copie células no Excel e aperte <span className="kbd">Ctrl</span>+<span className="kbd">V</span> em qualquer lugar
              desta página, ou arraste um arquivo .xlsx.
            </span>
            <button type="button" className="linkbtn" onClick={() => setTab('dados')}>
              Ver opções de dados
            </button>
          </div>
        ) : null}
        <Gallery config={state.chart} dataset={dataset} onPick={pickType} />
        <ChartView dataset={dataset} config={state.chart} uiDark={uiDark} onSize={handleSize} />

        <section className="data-card" aria-labelledby="grid-title">
          <header>
            <h2 id="grid-title">Tabela</h2>
            <div className="legend-keys">
              <span>
                <i style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)' }} /> categorias
              </span>
              <span>
                <i style={{ background: palette[0], borderRadius: '50%' }} /> série no gráfico
              </span>
              <span>
                Clique no cabeçalho ({state.data.orientation === 'columns' ? 'A, B, C…' : '1, 2, 3…'}) para pôr ou tirar do gráfico · clique numa célula para editar
              </span>
            </div>
            <button type="button" className="btn small" aria-expanded={gridOpen} onClick={() => setGridOpen((o) => !o)}>
              {gridOpen ? 'Recolher' : 'Mostrar'}
            </button>
          </header>
          {gridOpen && sheet ? (
            <DataGrid grid={sheet.grid} settings={state.data} dataset={dataset} colorOf={colorOf} onFieldClick={onFieldClick} onEdit={onEdit} />
          ) : null}
        </section>
      </main>

      <aside className="side" aria-label="Opções do gráfico">
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              className="tab"
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="panel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === 'dados' ? (
            <DataPanel
              state={state}
              dataset={dataset}
              uiDark={uiDark}
              setData={setData}
              setChart={setChart}
              onText={onText}
              onFile={onFile}
              onSample={onSample}
            />
          ) : null}
          {tab === 'visual' ? <VisualPanel config={state.chart} dataset={dataset} uiDark={uiDark} setChart={setChart} /> : null}
          {tab === 'rotulos' ? <LabelsPanel config={state.chart} dataset={dataset} setChart={setChart} /> : null}
          {tab === 'exportar' ? <ExportPanel config={state.chart} dataset={dataset} uiDark={uiDark} size={size} setChart={setChart} toast={toast} /> : null}
        </div>
      </aside>

      {dragging ? <div className="drop-overlay">Solte o arquivo para criar o gráfico</div> : null}
      {toastMsg ? (
        <div className="toast" role="status" aria-live="polite">
          {toastMsg}
        </div>
      ) : null}
    </div>
  );
}
