import { CHART_GALLERY, galleryIdFor, type ChartConfig, type ChartTypeInfo } from '../chart/config';
import type { Dataset } from '../data/types';
import { TYPE_ICONS } from './icons';

/** Sugere tipos de gráfico olhando o formato dos dados. */
export function suggestTypes(ds: Dataset): Set<string> {
  const out = new Set<string>();
  const n = ds.categories.length;
  const s = ds.series.length;
  if (s === 0 || n === 0) return out;
  const timeLike = ds.categories.every((c) =>
    /^(\d{4}|\d{1,2}\/\d{1,2}(\/\d{2,4})?|\d{1,2}\/\d{4}|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez|q\d|\d[º°]?\s?tri|t\d|sem)/i.test(c.trim()),
  );
  const avgLen = ds.categories.reduce((a, c) => a + c.length, 0) / n;
  const allPositive = ds.series.every((x) => x.values.every((v) => v === null || v >= 0));
  const numericX = ds.categoryValues.every((v) => v !== null) && !timeLike && ds.categoryField >= 0;

  if (numericX) out.add('scatter');
  if (timeLike && n >= 4) out.add('line');
  if (avgLen > 12 || n > 12) out.add('barh');
  else out.add('column');
  if (s === 1 && allPositive && n <= 6) out.add('donut');
  if (s === 2 && !timeLike) out.add('dumbbell');
  if (s === 1 && ds.series[0].values.some((v) => v !== null && v < 0) && ds.series[0].values.some((v) => v !== null && v > 0)) out.add('waterfall');
  return out;
}

export function Gallery({ config, dataset, onPick }: { config: ChartConfig; dataset: Dataset; onPick: (item: ChartTypeInfo) => void }) {
  const current = galleryIdFor(config);
  const suggested = suggestTypes(dataset);
  return (
    <nav className="gallery" aria-label="Tipo de gráfico">
      {CHART_GALLERY.map((item) => (
        <button
          key={item.id}
          type="button"
          className="type-chip"
          aria-pressed={item.id === current}
          title={`${item.name}: ${item.hint}${suggested.has(item.id) ? ' (sugerido para estes dados)' : ''}`}
          onClick={() => onPick(item)}
        >
          {TYPE_ICONS[item.id]}
          <span>{item.name}</span>
          {suggested.has(item.id) ? <span className="suggested" aria-label="sugerido" /> : null}
        </button>
      ))}
    </nav>
  );
}
