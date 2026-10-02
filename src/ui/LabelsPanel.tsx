import { isCartesian, isPartType, type AxisConfig, type ChartConfig, type LabelConfig, type NumberFormat } from '../chart/config';
import { makeFormatter } from '../chart/format';
import type { Dataset } from '../data/types';
import { NumberInput, Section, Segmented, Select, Slider, TextInput, Toggle } from './controls';

interface Props {
  config: ChartConfig;
  dataset: Dataset;
  setChart: (patch: Partial<ChartConfig>, key?: string) => void;
}

export function LabelsPanel({ config: c, dataset, setChart }: Props) {
  const part = isPartType(c.type);
  const labels = part ? c.partLabels : c.labels;
  const setLabels = (patch: Partial<LabelConfig>, key?: string) =>
    setChart(part ? { partLabels: { ...c.partLabels, ...patch } } : { labels: { ...c.labels, ...patch } }, key);
  const setNumber = (patch: Partial<NumberFormat>, key?: string) => setChart({ number: { ...c.number, ...patch } }, key);
  const setAxis = (which: 'catAxis' | 'valAxis', patch: Partial<AxisConfig>, key?: string) =>
    setChart({ [which]: { ...c[which], ...patch } } as Partial<ChartConfig>, key);

  const sample = dataset.series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const example = sample.length ? sample.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), sample[0]) : 1234.5;
  const effective: NumberFormat =
    c.number.style === 'auto' && dataset.hint === 'percent'
      ? { ...c.number, style: 'percent' }
      : c.number.style === 'auto' && dataset.hint === 'currency'
        ? { ...c.number, style: 'currency' }
        : c.number;
  const preview = makeFormatter(effective, sample)(example);

  const cartesian = isCartesian(c.type) || c.type === 'heatmap';
  const lineLike = c.type === 'line' || c.type === 'area';

  return (
    <>
      <Section title="Rótulos de dados">
        <Toggle
          label={part ? 'Mostrar valores junto dos nomes' : 'Mostrar valores no gráfico'}
          checked={labels.show}
          onChange={(v) => setLabels({ show: v })}
        />
        {labels.show ? (
          <>
            <Select
              label="O que mostrar"
              value={labels.content}
              options={
                part
                  ? [
                      { value: 'percent', label: 'Porcentagem do total' },
                      { value: 'value', label: 'Valor' },
                      { value: 'value+percent', label: 'Valor e porcentagem' },
                      { value: 'category', label: 'Só o nome' },
                    ]
                  : [
                      { value: 'value', label: 'Valor' },
                      { value: 'percent', label: dataset.series.length > 1 ? 'Porcentagem da categoria' : 'Porcentagem do total' },
                      { value: 'value+percent', label: 'Valor e porcentagem' },
                      { value: 'category', label: 'Nome da categoria' },
                      { value: 'category+value', label: 'Categoria: valor' },
                      { value: 'series', label: 'Nome da série' },
                      { value: 'series+value', label: 'Série: valor' },
                    ]
              }
              onChange={(v) => setLabels({ content: v })}
            />
            {!part && c.type !== 'heatmap' && c.type !== 'waterfall' ? (
              <Select
                label="Em quais pontos"
                value={labels.which}
                options={[
                  { value: 'all', label: 'Todos' },
                  { value: 'last', label: lineLike ? 'Só no fim da linha' : 'Só o último' },
                  { value: 'first+last', label: 'Primeiro e último' },
                  { value: 'maxmin', label: 'Só o maior e o menor' },
                ]}
                onChange={(v) => setLabels({ which: v })}
              />
            ) : null}
            {c.type !== 'heatmap' && c.type !== 'waterfall' && c.type !== 'treemap' && c.type !== 'dumbbell' && c.type !== 'lollipop' && c.type !== 'scatter' ? (
              <Select
                label="Posição"
                value={labels.position}
                options={
                  part
                    ? [
                        { value: 'outside', label: 'Fora, com linha guia' },
                        { value: 'inside', label: 'Dentro' },
                      ]
                    : [
                        { value: 'auto', label: 'Automática' },
                        { value: 'outside', label: lineLike ? 'Acima do ponto' : 'Na ponta, por fora' },
                        { value: 'inside', label: lineLike ? 'Sobre o ponto' : 'Dentro, na ponta' },
                        { value: 'base', label: lineLike ? 'Abaixo do ponto' : 'Na base' },
                      ]
                }
                onChange={(v) => setLabels({ position: v })}
              />
            ) : null}
          </>
        ) : null}
        <div className="row">
          <Slider label="Tamanho" value={labels.size} min={8} max={24} onChange={(v) => setLabels({ size: v }, 'label-size')} format={(v) => `${v}px`} />
        </div>
        <Toggle label="Negrito" checked={labels.bold} onChange={(v) => setLabels({ bold: v })} />
      </Section>

      <Section title="Formato dos números">
        <Select
          label="Estilo"
          value={c.number.style}
          options={[
            { value: 'auto', label: `Automático${dataset.hint === 'percent' ? ' (porcentagem)' : dataset.hint === 'currency' ? ' (moeda)' : ''}` },
            { value: 'number', label: 'Número (1.234,5)' },
            { value: 'compact', label: 'Compacto (1,2 mil · 3,4 mi)' },
            { value: 'percent', label: 'Porcentagem (0,25 → 25%)' },
            { value: 'currency', label: 'Moeda' },
          ]}
          onChange={(v) => setNumber({ style: v })}
          help={
            <>
              Exemplo: <b>{preview}</b>
            </>
          }
        />
        {c.number.style === 'currency' || (c.number.style === 'auto' && dataset.hint === 'currency') ? (
          <Segmented
            label="Moeda"
            value={c.number.currency}
            options={[
              { value: 'BRL', label: 'R$' },
              { value: 'USD', label: 'US$' },
              { value: 'EUR', label: '€' },
            ]}
            onChange={(v) => setNumber({ currency: v })}
          />
        ) : null}
        <Segmented
          label="Casas decimais"
          value={c.number.decimals ?? -1}
          options={[
            { value: -1, label: 'Auto' },
            { value: 0, label: '0' },
            { value: 1, label: '1' },
            { value: 2, label: '2' },
            { value: 3, label: '3' },
          ]}
          onChange={(v) => setNumber({ decimals: v === -1 ? null : v })}
        />
        <div className="row">
          <TextInput label="Antes do número" value={c.number.prefix} onChange={(v) => setNumber({ prefix: v }, 'prefix')} placeholder="Ex.: ~" />
          <TextInput label="Depois do número" value={c.number.suffix} onChange={(v) => setNumber({ suffix: v }, 'suffix')} placeholder="Ex.: kg, %, mil" />
        </div>
        <Segmented
          label="Padrão de escrita"
          value={c.number.locale}
          options={[
            { value: 'pt-BR', label: 'Brasil (1.234,5)' },
            { value: 'en-US', label: 'EUA (1,234.5)' },
          ]}
          onChange={(v) => setNumber({ locale: v })}
        />
      </Section>

      {cartesian ? (
        <Section title="Eixos">
          <AxisFields
            title={c.type === 'scatter' ? 'Eixo X' : 'Eixo das categorias'}
            axis={c.catAxis}
            onChange={(p, k) => setAxis('catAxis', p, k)}
            showRotate={!c.horizontal || c.type === 'heatmap'}
            showRange={false}
          />
          {c.type !== 'heatmap' ? (
            <AxisFields
              title={c.type === 'scatter' ? 'Eixo Y' : 'Eixo dos valores'}
              axis={c.valAxis}
              onChange={(p, k) => setAxis('valAxis', p, k)}
              showRotate={false}
              showRange={c.stack !== 'percent'}
            />
          ) : (
            <TextInput label="Título das linhas" value={c.valAxis.title} onChange={(v) => setAxis('valAxis', { title: v }, 'valAxis-title')} />
          )}
        </Section>
      ) : null}

      {isCartesian(c.type) && c.type !== 'waterfall' && c.type !== 'dumbbell' && c.stack !== 'percent' ? (
        <Section title="Linhas de referência">
          <Toggle label="Linha da média" checked={c.reference.average} onChange={(v) => setChart({ reference: { ...c.reference, average: v } })} />
          <Toggle label="Linha de meta" checked={c.reference.target} onChange={(v) => setChart({ reference: { ...c.reference, target: v } })} />
          {c.reference.target ? (
            <div className="row">
              <NumberInput
                label="Valor da meta"
                value={c.reference.targetValue}
                allowEmpty={false}
                onChange={(v) => setChart({ reference: { ...c.reference, targetValue: v ?? 0 } })}
              />
              <TextInput label="Texto" value={c.reference.targetLabel} onChange={(v) => setChart({ reference: { ...c.reference, targetLabel: v } }, 'target-label')} />
            </div>
          ) : null}
        </Section>
      ) : null}
    </>
  );
}

function AxisFields({
  title,
  axis,
  onChange,
  showRotate,
  showRange,
}: {
  title: string;
  axis: AxisConfig;
  onChange: (p: Partial<AxisConfig>, key?: string) => void;
  showRotate: boolean;
  showRange: boolean;
}) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <legend className="label" style={{ marginBottom: 8, color: 'var(--ink)' }}>
        {title}
      </legend>
      <TextInput label="Título do eixo" value={axis.title} onChange={(v) => onChange({ title: v }, `${title}-title`)} />
      <Toggle label="Mostrar rótulos do eixo" checked={axis.show} onChange={(v) => onChange({ show: v })} />
      <Toggle label="Linhas de grade" checked={axis.grid} onChange={(v) => onChange({ grid: v })} />
      {showRotate ? (
        <Slider label="Inclinar rótulos" value={axis.rotate} min={-90} max={90} step={15} onChange={(v) => onChange({ rotate: v }, `${title}-rot`)} format={(v) => `${v}°`} />
      ) : null}
      {showRange ? (
        <>
          <div className="row">
            <NumberInput label="Mínimo" value={axis.min} placeholder="auto" onChange={(v) => onChange({ min: v })} />
            <NumberInput label="Máximo" value={axis.max} placeholder="auto" onChange={(v) => onChange({ max: v })} />
          </div>
          <Toggle label="Escala logarítmica" checked={axis.log} onChange={(v) => onChange({ log: v })} />
        </>
      ) : null}
    </fieldset>
  );
}
