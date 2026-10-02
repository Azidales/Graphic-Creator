import { useRef, useState } from 'react';
import type { ChartConfig, SeriesStyle } from '../chart/config';
import { isSingleSeries } from '../chart/config';
import { getPalette } from '../chart/palettes';
import { SAMPLES } from '../data/samples';
import type { Aggregate, DataSettings, Dataset, SortMode } from '../data/types';
import type { AppState } from '../state';
import { Field, Section, Segmented, Select, Slider, Swatch, Toggle } from './controls';
import { Icon } from './icons';

interface Props {
  state: AppState;
  dataset: Dataset;
  uiDark: boolean;
  setData: (patch: Partial<DataSettings>, key?: string) => void;
  setChart: (patch: Partial<ChartConfig>, key?: string) => void;
  onText: (text: string, source?: string) => void;
  onFile: (file: File) => void;
  onSample: (id: string) => void;
}

export function DataPanel({ state, dataset, uiDark, setData, setChart, onText, onFile, onSample }: Props) {
  const { workbook, data, chart } = state;
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState('');
  const sheet = workbook.sheets[data.sheetIndex] ?? workbook.sheets[0];
  const pal = getPalette(chart.palette)[uiDark ? 'dark' : 'light'];

  const numericFields = dataset.fields.filter((f) => f.numeric && f.index !== dataset.categoryField);
  const chosen = new Set(dataset.series.map((s) => s.field));
  const slotOf = new Map(dataset.fields.filter((f) => f.numeric).map((f, i) => [f.index, i]));

  const toggleSeries = (field: number, on: boolean) => {
    const current = data.seriesFields ?? numericFields.map((f) => f.index);
    const next = on ? Array.from(new Set([...current, field])) : current.filter((f) => f !== field);
    next.sort((a, b) => a - b);
    setData({ seriesFields: next });
  };

  const setSeriesStyle = (name: string, patch: SeriesStyle) => {
    setChart({ seriesStyle: { ...chart.seriesStyle, [name]: { ...chart.seriesStyle[name], ...patch } } }, `series-style-${name}`);
  };

  const hidden = new Set(data.hiddenCategories);
  const sortFieldOptions = [
    { value: -1, label: 'Soma das séries' },
    ...dataset.series.map((s) => ({ value: s.field, label: s.name })),
  ];

  return (
    <>
      <Section title="Tabela">
        <div className="source-line">
          {Icon.table}
          <span>Usando</span>
          <strong title={workbook.source}>{workbook.source}</strong>
        </div>
        <div className="dropzone">
          <label className="label" htmlFor="paste-area">
            Cole sua tabela aqui
          </label>
          <textarea
            id="paste-area"
            className="input"
            placeholder={'Copie as células no Excel (Ctrl+C) e cole aqui (Ctrl+V).\nTambém aceita CSV e texto separado por ponto e vírgula.'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onPaste={(e) => {
              const text = e.clipboardData.getData('text/plain');
              if (text.trim()) {
                e.preventDefault();
                onText(text, 'Colado');
                setDraft('');
              }
            }}
          />
          <div className="actions">
            {draft.trim() ? (
              <button
                type="button"
                className="btn primary small"
                onClick={() => {
                  onText(draft, 'Digitado');
                  setDraft('');
                }}
              >
                Usar este texto
              </button>
            ) : null}
            <button type="button" className="btn small" onClick={() => fileRef.current?.click()}>
              {Icon.upload}
              Enviar .xlsx ou .csv
            </button>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept=".xlsx,.xlsm,.xls,.ods,.csv,.tsv,.txt"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = '';
              }}
            />
          </div>
          <span className="help">Você também pode arrastar o arquivo para qualquer lugar da página.</span>
        </div>
        <Select
          label="Exemplos para testar"
          value=""
          options={[{ value: '', label: 'Escolha um exemplo…' }, ...SAMPLES.map((s) => ({ value: s.id, label: `${s.name} — ${s.description}` }))]}
          onChange={(id) => id && onSample(id)}
        />
        {workbook.sheets.length > 1 ? (
          <Select
            label="Planilha (aba)"
            value={data.sheetIndex}
            options={workbook.sheets.map((s, i) => ({ value: i, label: `${s.name} (${s.grid.length} linhas)` }))}
            onChange={(i) => setData({ sheetIndex: i, categoryField: null, seriesFields: null, hiddenCategories: [] })}
          />
        ) : null}
        {sheet ? null : <span className="help">Nenhuma planilha com dados.</span>}
      </Section>

      <Section title="Linhas e colunas">
        <Field label="As séries estão nas" help="É o “Alternar Linha/Coluna” do Excel, em um clique.">
          <div className="row" style={{ alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <Segmented
                value={data.orientation}
                options={[
                  { value: 'columns', label: 'Colunas' },
                  { value: 'rows', label: 'Linhas' },
                ]}
                onChange={(v) => setData({ orientation: v, categoryField: null, seriesFields: null, hiddenCategories: [], sortField: -1 })}
              />
            </div>
            <button
              type="button"
              className="btn small"
              title="Inverter linhas e colunas"
              onClick={() =>
                setData({
                  orientation: data.orientation === 'columns' ? 'rows' : 'columns',
                  categoryField: null,
                  seriesFields: null,
                  hiddenCategories: [],
                  sortField: -1,
                })
              }
            >
              {Icon.swap}
              Inverter
            </button>
          </div>
        </Field>
        <Segmented
          label={data.orientation === 'columns' ? 'Primeira linha tem os nomes' : 'Primeira coluna tem os nomes'}
          value={data.header}
          options={[
            { value: 'auto', label: `Automático (${dataset.headerUsed ? 'sim' : 'não'})` },
            { value: true, label: 'Sim' },
            { value: false, label: 'Não' },
          ]}
          onChange={(v) => setData({ header: v, categoryField: null, seriesFields: null })}
        />
        <Select
          label={chart.type === 'scatter' ? 'Eixo X (horizontal)' : 'Categorias (rótulos do eixo)'}
          value={dataset.categoryField}
          options={[
            ...dataset.fields.map((f) => ({ value: f.index, label: f.name + (f.numeric ? ' (números)' : '') })),
            { value: -1, label: 'Nenhuma: numerar 1, 2, 3…' },
          ]}
          onChange={(v) => setData({ categoryField: v, seriesFields: null })}
        />
        <Segmented
          label="Separador decimal"
          value={data.decimal}
          options={[
            { value: 'auto', label: `Auto (${dataset.decimalUsed === ',' ? 'vírgula' : 'ponto'})` },
            { value: ',', label: '1.234,5' },
            { value: '.', label: '1,234.5' },
          ]}
          onChange={(v) => setData({ decimal: v })}
        />
      </Section>

      <Section title={`Séries (${dataset.series.length} de ${numericFields.length})`}>
        {isSingleSeries(chart.type) && dataset.series.length > 1 ? (
          <span className="help">Este tipo de gráfico usa só a primeira série marcada.</span>
        ) : null}
        {numericFields.length === 0 ? (
          <span className="help">Nenhuma coluna com números. Confira o separador decimal ou inverta linhas e colunas.</span>
        ) : (
          <>
            <div className="item-list">
              {numericFields.map((f) => {
                const on = chosen.has(f.index);
                const color = chart.seriesStyle[f.name]?.color ?? pal[(slotOf.get(f.index) ?? 0) % pal.length];
                return (
                  <div className="item" key={f.index}>
                    <label>
                      <input type="checkbox" checked={on} onChange={(e) => toggleSeries(f.index, e.target.checked)} />
                      <span className="name" title={f.name}>
                        {f.name}
                      </span>
                    </label>
                    {chart.type === 'combo' && on ? (
                      <select
                        className="mini-select"
                        aria-label={`Forma da série ${f.name}`}
                        value={chart.seriesStyle[f.name]?.as ?? (dataset.series[0]?.field === f.index ? 'bar' : 'line')}
                        onChange={(e) => setSeriesStyle(f.name, { as: e.target.value as SeriesStyle['as'] })}
                      >
                        <option value="bar">Coluna</option>
                        <option value="line">Linha</option>
                        <option value="area">Área</option>
                      </select>
                    ) : null}
                    {['line', 'area', 'combo', 'radar'].includes(chart.type) && on ? (
                      <button
                        type="button"
                        className="btn ghost small"
                        title="Linha tracejada"
                        aria-pressed={Boolean(chart.seriesStyle[f.name]?.dashed)}
                        onClick={() => setSeriesStyle(f.name, { dashed: !chart.seriesStyle[f.name]?.dashed })}
                        style={{ fontWeight: chart.seriesStyle[f.name]?.dashed ? 700 : 400 }}
                      >
                        - -
                      </button>
                    ) : null}
                    <Swatch value={color} label={`Cor da série ${f.name}`} onChange={(c) => setSeriesStyle(f.name, { color: c })} />
                  </div>
                );
              })}
            </div>
            <div className="row">
              <button type="button" className="linkbtn" onClick={() => setData({ seriesFields: null })}>
                Marcar todas
              </button>
              <button type="button" className="linkbtn" onClick={() => setData({ seriesFields: [] })}>
                Desmarcar todas
              </button>
              {Object.keys(chart.seriesStyle).length ? (
                <button type="button" className="linkbtn" onClick={() => setChart({ seriesStyle: {} })}>
                  Voltar às cores da paleta
                </button>
              ) : null}
            </div>
          </>
        )}
      </Section>

      <Section title="Categorias">
        <Select<Aggregate>
          label="Categorias repetidas"
          value={data.aggregate}
          options={[
            { value: 'none', label: 'Manter separadas' },
            { value: 'sum', label: 'Agrupar: soma' },
            { value: 'avg', label: 'Agrupar: média' },
            { value: 'count', label: 'Agrupar: contagem' },
            { value: 'min', label: 'Agrupar: mínimo' },
            { value: 'max', label: 'Agrupar: máximo' },
          ]}
          onChange={(v) => setData({ aggregate: v })}
          help="Funciona como uma tabela dinâmica rápida."
        />
        <div className="row">
          <Select<SortMode>
            label="Ordem"
            value={data.sort}
            options={[
              { value: 'none', label: 'Como na planilha' },
              { value: 'desc', label: 'Maior → menor' },
              { value: 'asc', label: 'Menor → maior' },
              { value: 'alpha', label: 'A → Z' },
            ]}
            onChange={(v) => setData({ sort: v })}
          />
          {(data.sort === 'asc' || data.sort === 'desc' || data.topN > 0) && dataset.series.length > 1 ? (
            <Select label="Pelo valor de" value={data.sortField} options={sortFieldOptions} onChange={(v) => setData({ sortField: v })} />
          ) : null}
        </div>
        <Slider
          label="Mostrar só as maiores"
          value={data.topN}
          min={0}
          max={Math.max(10, Math.min(50, dataset.allCategories.length))}
          onChange={(v) => setData({ topN: v }, 'topN')}
          format={(v) => (v === 0 ? 'Todas' : `Top ${v}`)}
        />
        {data.topN > 0 ? <Toggle label="Juntar o resto em “Outros”" checked={data.groupOthers} onChange={(v) => setData({ groupOthers: v })} /> : null}
        {dataset.allCategories.length > 0 && dataset.allCategories.length <= 150 ? (
          <Field label={`Mostrar categorias (${dataset.allCategories.length - hidden.size} de ${dataset.allCategories.length})`}>
            <div className="item-list" style={{ maxHeight: 200 }}>
              {dataset.allCategories.map((c) => (
                <div className="item" key={c}>
                  <label>
                    <input
                      type="checkbox"
                      checked={!hidden.has(c)}
                      onChange={(e) =>
                        setData({
                          hiddenCategories: e.target.checked ? data.hiddenCategories.filter((h) => h !== c) : [...data.hiddenCategories, c],
                        })
                      }
                    />
                    <span className="name" title={c}>
                      {c}
                    </span>
                  </label>
                </div>
              ))}
            </div>
            {hidden.size ? (
              <button type="button" className="linkbtn" onClick={() => setData({ hiddenCategories: [] })}>
                Mostrar todas
              </button>
            ) : null}
          </Field>
        ) : null}
      </Section>
    </>
  );
}
