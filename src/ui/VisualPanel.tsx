import type { ReactNode } from 'react';
import {
  DEFAULT_CONFIG,
  FONT_OPTIONS,
  isCartesian,
  isPartType,
  supportsFacet,
  supportsHorizontal,
  supportsStack,
  type ChartConfig,
  type ColorMode,
} from '../chart/config';
import { PALETTES, RAMPS, getPalette, mix } from '../chart/palettes';
import type { Dataset } from '../data/types';
import { ColorInput, Field, Section, Segmented, Select, Slider, Swatch, TextInput, Toggle } from './controls';

interface Props {
  config: ChartConfig;
  dataset: Dataset;
  uiDark: boolean;
  setChart: (patch: Partial<ChartConfig> | ((c: ChartConfig) => Partial<ChartConfig>), key?: string) => void;
}

interface QuickStyle {
  id: string;
  name: string;
  apply: (c: ChartConfig, ds: Dataset) => Partial<ChartConfig>;
}

export const QUICK_STYLES: QuickStyle[] = [
  {
    id: 'padrao',
    name: 'Padrão',
    apply: (c) => ({
      ...DEFAULT_CONFIG,
      type: c.type,
      horizontal: c.horizontal,
      stack: c.stack,
      facet: c.facet,
      title: c.title,
      subtitle: c.subtitle,
      source: c.source,
      size: c.size,
      exportScale: c.exportScale,
      partLabels: c.partLabels,
    }),
  },
  {
    id: 'limpo',
    name: 'Limpo',
    apply: (c) => ({
      valAxis: { ...c.valAxis, show: false, grid: false },
      catAxis: { ...c.catAxis, show: true, grid: false },
      labels: { ...c.labels, show: true, which: c.type === 'line' || c.type === 'area' ? 'last' : 'all' },
      barRadius: 4,
    }),
  },
  {
    id: 'apresentacao',
    name: 'Apresentação',
    apply: (c) => ({
      fontScale: 1.3,
      labels: { ...c.labels, show: true, bold: true, size: 14 },
      partLabels: { ...c.partLabels, bold: true, size: 14 },
      barWidth: 70,
      lineWidth: 3,
      symbolSize: 10,
    }),
  },
  {
    id: 'destaque',
    name: 'Destacar o maior',
    apply: (c, ds) => {
      if (ds.series.length > 1) {
        const totals = ds.series.map((s) => s.values.reduce<number>((a, v) => a + (v ?? 0), 0));
        return { colorMode: 'highlight', highlight: [ds.series[totals.indexOf(Math.max(...totals))].name] };
      }
      const vals = ds.series[0]?.values ?? [];
      let best = 0;
      vals.forEach((v, i) => {
        if ((v ?? -Infinity) > (vals[best] ?? -Infinity)) best = i;
      });
      return { colorMode: 'highlight', highlight: ds.categories[best] ? [ds.categories[best]] : [], labels: { ...c.labels, show: true } };
    },
  },
  {
    id: 'pb',
    name: 'Impressão P&B',
    apply: () => ({ colorMode: 'none', patterns: true, background: 'white', theme: 'light' }),
  },
  {
    id: 'escuro',
    name: 'Fundo escuro',
    apply: () => ({ theme: 'dark', background: 'auto' }),
  },
];

const COLOR_MODES: { value: ColorMode; label: string; title: string }[] = [
  { value: 'palette', label: 'Paleta', title: 'Uma cor para cada série' },
  { value: 'single', label: 'Uma cor', title: 'Tudo em uma cor (tons dela se houver várias séries)' },
  { value: 'highlight', label: 'Destaque', title: 'Cinza em tudo, cor só no que importa' },
  { value: 'posneg', label: '+ / −', title: 'Uma cor para positivos e outra para negativos' },
  { value: 'gradient', label: 'Gradiente', title: 'Cor mais forte para valores maiores' },
  { value: 'none', label: 'Sem cor', title: 'Tons de cinza, com hachuras para diferenciar' },
];

export function VisualPanel({ config: c, dataset, uiDark, setChart }: Props) {
  const pal = getPalette(c.palette)[uiDark ? 'dark' : 'light'];
  const singleSeries = dataset.series.length <= 1 || isPartType(c.type) || c.type === 'waterfall';
  const highlightTargets = singleSeries ? dataset.categories : dataset.series.map((s) => s.name);
  const perCategory = isPartType(c.type) || (singleSeries && c.varyColors);

  const lineLike = ['line', 'area', 'combo', 'radar'].includes(c.type);
  const barLike = ['bar', 'combo', 'waterfall', 'lollipop'].includes(c.type);

  return (
    <>
      <Section title="Estilos rápidos">
        <div className="chips">
          {QUICK_STYLES.map((q) => (
            <button key={q.id} type="button" className="chip" onClick={() => setChart((cur) => q.apply(cur, dataset))}>
              {q.name}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Títulos e texto">
        <TextInput id="cfg-title" label="Título" value={c.title} onChange={(v) => setChart({ title: v }, 'title')} placeholder="Ex.: Vendas por trimestre" />
        <TextInput id="cfg-subtitle" label="Subtítulo" value={c.subtitle} onChange={(v) => setChart({ subtitle: v }, 'subtitle')} placeholder="Ex.: Em R$ mil, 2025" />
        <TextInput id="cfg-source" label="Rodapé" value={c.source} onChange={(v) => setChart({ source: v }, 'source')} placeholder="Ex.: Fonte: ERP interno" />
        <div className="row">
          <Segmented
            label="Alinhar título"
            value={c.titleAlign}
            options={[
              { value: 'left', label: 'Esquerda' },
              { value: 'center', label: 'Centro' },
            ]}
            onChange={(v) => setChart({ titleAlign: v })}
          />
          <Select label="Fonte" value={c.fontFamily} options={FONT_OPTIONS.map((f) => ({ value: f.id, label: f.name }))} onChange={(v) => setChart({ fontFamily: v })} />
        </div>
        <Slider label="Tamanho do texto" value={c.fontScale} min={0.7} max={1.8} step={0.05} onChange={(v) => setChart({ fontScale: v }, 'fontScale')} format={(v) => `${Math.round(v * 100)}%`} />
      </Section>

      <Section title="Cores">
        <Segmented label="Como colorir" value={c.colorMode} options={COLOR_MODES} onChange={(v) => setChart({ colorMode: v })} />

        {c.colorMode === 'palette' ? (
          <>
            <Field label="Paleta">
              <div className="palette-list">
                {PALETTES.map((p) => (
                  <button key={p.id} type="button" className="palette-option" aria-pressed={p.id === c.palette} onClick={() => setChart({ palette: p.id })}>
                    <span>{p.name}</span>
                    <span className="dots" aria-hidden="true">
                      {(uiDark ? p.dark : p.light).slice(0, 6).map((col) => (
                        <span key={col} style={{ background: col }} />
                      ))}
                    </span>
                  </button>
                ))}
              </div>
            </Field>
            {singleSeries && isCartesian(c.type) && c.type !== 'waterfall' ? (
              <Toggle label="Uma cor para cada categoria" checked={c.varyColors} onChange={(v) => setChart({ varyColors: v })} />
            ) : null}
            {perCategory && dataset.categories.length <= 40 ? (
              <Field label="Cor de cada categoria">
                <div className="item-list" style={{ maxHeight: 220 }}>
                  {dataset.categories.map((cat, i) => (
                    <div className="item" key={cat}>
                      <span className="name" style={{ flex: 1 }} title={cat}>
                        {cat}
                      </span>
                      <Swatch
                        label={`Cor de ${cat}`}
                        value={c.categoryColors[cat] ?? pal[(dataset.categorySlots[i] ?? i) % pal.length]}
                        onChange={(col) => setChart({ categoryColors: { ...c.categoryColors, [cat]: col } }, `cat-color-${cat}`)}
                      />
                    </div>
                  ))}
                </div>
                {Object.keys(c.categoryColors).length ? (
                  <button type="button" className="linkbtn" onClick={() => setChart({ categoryColors: {} })}>
                    Voltar às cores da paleta
                  </button>
                ) : null}
              </Field>
            ) : null}
          </>
        ) : null}

        {c.colorMode === 'single' ? <ColorInput label="Cor" value={c.singleColor} onChange={(v) => setChart({ singleColor: v }, 'singleColor')} /> : null}

        {c.colorMode === 'highlight' ? (
          <>
            <Field label={singleSeries ? 'Categorias em destaque' : 'Séries em destaque'} help="Clique para ligar ou desligar. O resto fica em cinza.">
              <div className="chips">
                {highlightTargets.slice(0, 60).map((name) => {
                  const on = c.highlight.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      className="chip"
                      aria-pressed={on}
                      onClick={() => setChart({ highlight: on ? c.highlight.filter((h) => h !== name) : [...c.highlight, name] })}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </Field>
            {singleSeries ? <ColorInput label="Cor do destaque" value={c.highlightColor} onChange={(v) => setChart({ highlightColor: v }, 'hl')} /> : null}
          </>
        ) : null}

        {c.colorMode === 'posneg' || c.type === 'waterfall' ? (
          <div className="row">
            <ColorInput label={c.type === 'waterfall' ? 'Aumento' : 'Positivos'} value={c.posColor} onChange={(v) => setChart({ posColor: v }, 'pos')} />
            <ColorInput label={c.type === 'waterfall' ? 'Redução' : 'Negativos'} value={c.negColor} onChange={(v) => setChart({ negColor: v }, 'neg')} />
            {c.type === 'waterfall' ? <ColorInput label="Total" value={c.totalColor} onChange={(v) => setChart({ totalColor: v }, 'total')} /> : null}
          </div>
        ) : null}

        {c.colorMode === 'gradient' || c.type === 'heatmap' ? (
          <Field label="Escala de cor">
            <div className="palette-list">
              {RAMPS.map((r) => (
                <button key={r.id} type="button" className="palette-option" aria-pressed={r.id === c.ramp} onClick={() => setChart({ ramp: r.id })}>
                  <span>{r.name}</span>
                  <span className="dots" aria-hidden="true">
                    {[0, 0.25, 0.5, 0.75, 1].map((t) => (
                      <span key={t} style={{ background: mix(r.from, r.to, t) }} />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </Field>
        ) : null}

        <Toggle label="Hachuras (bom para imprimir e para daltonismo)" checked={c.patterns || c.colorMode === 'none'} onChange={(v) => setChart({ patterns: v })} />
      </Section>

      <Section title="Fundo e tema">
        <Segmented
          label="Tema do gráfico"
          value={c.theme}
          options={[
            { value: 'auto', label: 'Igual ao app' },
            { value: 'light', label: 'Claro' },
            { value: 'dark', label: 'Escuro' },
          ]}
          onChange={(v) => setChart({ theme: v })}
        />
        <Segmented
          label="Fundo"
          value={c.background}
          options={[
            { value: 'auto', label: 'Do tema' },
            { value: 'white', label: 'Branco' },
            { value: 'transparent', label: 'Transparente' },
            { value: 'custom', label: 'Outra cor' },
          ]}
          onChange={(v) => setChart({ background: v })}
        />
        {c.background === 'custom' ? <ColorInput label="Cor do fundo" value={c.backgroundColor} onChange={(v) => setChart({ backgroundColor: v }, 'bg')} /> : null}
      </Section>

      <Section title="Formato">
        <ShapeControls c={c} dataset={dataset} setChart={setChart} lineLike={lineLike} barLike={barLike} />
      </Section>

      <Section title="Legenda e interação">
        <Segmented
          label="Legenda"
          value={c.legend.show}
          options={[
            { value: 'auto', label: 'Automática' },
            { value: true, label: 'Mostrar' },
            { value: false, label: 'Esconder' },
          ]}
          onChange={(v) => setChart({ legend: { ...c.legend, show: v } })}
        />
        <Segmented
          label="Posição da legenda"
          value={c.legend.position}
          options={[
            { value: 'top', label: 'Em cima' },
            { value: 'bottom', label: 'Embaixo' },
            { value: 'left', label: 'Esquerda' },
            { value: 'right', label: 'Direita' },
          ]}
          onChange={(v) => setChart({ legend: { ...c.legend, position: v } })}
        />
        <Toggle label="Mostrar valores ao passar o mouse" checked={c.tooltip} onChange={(v) => setChart({ tooltip: v })} />
        <Toggle label="Animações" checked={c.animation} onChange={(v) => setChart({ animation: v })} />
      </Section>
    </>
  );
}

function ShapeControls({
  c,
  dataset,
  setChart,
  lineLike,
  barLike,
}: {
  c: ChartConfig;
  dataset: Dataset;
  setChart: Props['setChart'];
  lineLike: boolean;
  barLike: boolean;
}) {
  const items: ReactNode[] = [];
  if (supportsHorizontal(c.type)) {
    items.push(
      <Segmented
        key="orient"
        label="Orientação"
        value={c.horizontal}
        options={[
          { value: false, label: 'Vertical' },
          { value: true, label: 'Horizontal' },
        ]}
        onChange={(v) => setChart({ horizontal: v })}
      />,
    );
  }
  if (supportsStack(c.type) && dataset.series.length > 1 && !c.facet) {
    items.push(
      <Segmented
        key="stack"
        label="Várias séries"
        value={c.stack}
        options={[
          { value: 'none', label: 'Lado a lado' },
          { value: 'stacked', label: 'Empilhadas' },
          { value: 'percent', label: 'Empilhadas 100%' },
        ]}
        onChange={(v) => setChart({ stack: v })}
      />,
    );
  }
  if (supportsFacet(c.type) && dataset.series.length > 1) {
    items.push(<Toggle key="facet" label="Um painel pequeno por série" checked={c.facet} onChange={(v) => setChart({ facet: v })} />);
    if (c.facet) {
      items.push(<Toggle key="facet-scale" label="Mesma escala em todos os painéis" checked={c.facetSharedScale} onChange={(v) => setChart({ facetSharedScale: v })} />);
    }
  }
  if (barLike) {
    items.push(
      <Slider key="bw" label="Espessura das barras" value={c.barWidth} min={10} max={95} onChange={(v) => setChart({ barWidth: v }, 'barWidth')} format={(v) => `${v}%`} />,
    );
    if (c.type !== 'lollipop') {
      items.push(<Slider key="br" label="Cantos arredondados" value={c.barRadius} min={0} max={20} onChange={(v) => setChart({ barRadius: v }, 'barRadius')} format={(v) => `${v}px`} />);
    }
    if ((c.type === 'bar' || c.type === 'combo') && dataset.series.length > 1 && c.stack === 'none') {
      items.push(<Slider key="bg" label="Espaço entre séries" value={c.barGap} min={-100} max={100} onChange={(v) => setChart({ barGap: v }, 'barGap')} format={(v) => `${v}%`} />);
    }
  }
  if (lineLike) {
    items.push(<Toggle key="smooth" label="Linhas suaves (curvas)" checked={c.smooth} onChange={(v) => setChart({ smooth: v, step: v ? false : c.step })} />);
    if (c.type !== 'radar') items.push(<Toggle key="step" label="Linhas em degrau" checked={c.step} onChange={(v) => setChart({ step: v, smooth: v ? false : c.smooth })} />);
    items.push(<Slider key="lw" label="Espessura da linha" value={c.lineWidth} min={1} max={8} step={0.5} onChange={(v) => setChart({ lineWidth: v }, 'lineWidth')} format={(v) => `${v}px`} />);
    items.push(<Toggle key="sym" label="Marcadores nos pontos" checked={c.symbols} onChange={(v) => setChart({ symbols: v })} />);
    if (c.type === 'area' || c.type === 'radar' || c.type === 'combo') {
      items.push(
        <Slider key="ao" label="Opacidade da área" value={c.areaOpacity} min={0} max={1} step={0.02} onChange={(v) => setChart({ areaOpacity: v }, 'areaOpacity')} format={(v) => `${Math.round(v * 100)}%`} />,
      );
    }
    if (c.type !== 'radar') items.push(<Toggle key="nulls" label="Ligar pontos sobre células vazias" checked={c.connectNulls} onChange={(v) => setChart({ connectNulls: v })} />);
  }
  if (lineLike || ['scatter', 'lollipop', 'dumbbell'].includes(c.type)) {
    items.push(<Slider key="ss" label="Tamanho dos pontos" value={c.symbolSize} min={2} max={24} onChange={(v) => setChart({ symbolSize: v }, 'symbolSize')} format={(v) => `${v}px`} />);
  }
  if (c.type === 'donut') {
    items.push(<Slider key="ir" label="Furo da rosca" value={c.innerRadius} min={20} max={85} onChange={(v) => setChart({ innerRadius: v }, 'innerRadius')} format={(v) => `${v}%`} />);
    items.push(<Toggle key="ct" label="Total no centro" checked={c.centerTotal} onChange={(v) => setChart({ centerTotal: v })} />);
  }
  if (c.type === 'pie' || c.type === 'donut') {
    items.push(<Toggle key="rose" label="Fatias com raio pelo valor (rosa)" checked={c.rose} onChange={(v) => setChart({ rose: v })} />);
  }
  if (c.type === 'waterfall') {
    items.push(<Toggle key="wt" label="Barra de total no fim" checked={c.waterfallTotal} onChange={(v) => setChart({ waterfallTotal: v })} />);
  }
  if (['bar', 'line', 'scatter', 'lollipop', 'combo'].includes(c.type) && c.stack === 'none') {
    items.push(<Toggle key="trend" label="Linha de tendência" checked={c.trendline} onChange={(v) => setChart({ trendline: v })} />);
  }
  if (!items.length) return <span className="help">Este tipo não tem opções de formato extras.</span>;
  return <>{items}</>;
}
