import { describe, expect, it } from 'vitest';
import { echarts } from './echarts';
import { buildOption } from './buildOption';
import { CHART_GALLERY, DEFAULT_CONFIG, type ChartConfig } from './config';
import { buildDataset, DEFAULT_DATA_SETTINGS } from '../data/dataset';
import { detectHint, parsePastedText } from '../data/parseText';
import { SAMPLES } from '../data/samples';
import { makeFormatter } from './format';

function dataset(tsv: string) {
  const grid = parsePastedText(tsv);
  return buildDataset(grid, DEFAULT_DATA_SETTINGS, detectHint(grid));
}

/** Desenha de verdade (SVG no Node) para pegar erros de layout e de renderItem. */
function render(cfg: ChartConfig, tsv: string, dark = false): { svg: string; notes: string[] } {
  const built = buildOption(dataset(tsv), cfg, { width: 800, height: 500, uiDark: dark, reducedMotion: true });
  const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 800, height: 500 });
  chart.setOption(built.option);
  const svg = chart.renderToSVGString();
  chart.dispose();
  return { svg, notes: built.notes };
}

const config = (patch: Partial<ChartConfig>): ChartConfig => ({ ...DEFAULT_CONFIG, animation: false, ...patch });

describe('buildOption', () => {
  for (const item of CHART_GALLERY) {
    for (const sample of SAMPLES) {
      it(`desenha ${item.name} com "${sample.name}"`, () => {
        const { svg } = render(
          config({ type: item.type, horizontal: item.horizontal ?? false, title: 'Título', subtitle: 'Sub', source: 'Fonte: teste' }),
          sample.tsv,
        );
        expect(svg).toContain('<svg');
      });
    }
  }

  it('aplica rótulos, referências, tendência e empilhamento sem erros', () => {
    const tsv = SAMPLES[0].tsv;
    const variants: Partial<ChartConfig>[] = [
      { type: 'bar', stack: 'stacked', labels: { ...DEFAULT_CONFIG.labels, show: true } },
      { type: 'bar', stack: 'percent', labels: { ...DEFAULT_CONFIG.labels, show: true, content: 'percent' } },
      { type: 'bar', horizontal: true, labels: { ...DEFAULT_CONFIG.labels, show: true, which: 'maxmin' } },
      { type: 'line', labels: { ...DEFAULT_CONFIG.labels, show: true, which: 'last' }, trendline: true },
      { type: 'area', stack: 'stacked', smooth: true },
      { type: 'combo', reference: { average: true, target: true, targetValue: 200000, targetLabel: 'Meta' } },
      { type: 'bar', facet: true },
      { type: 'line', facet: true, facetSharedScale: false },
      { type: 'lollipop', facet: true, labels: { ...DEFAULT_CONFIG.labels, show: true } },
      { type: 'scatter', trendline: true, labels: { ...DEFAULT_CONFIG.labels, show: true, content: 'category' } },
      { type: 'bar', colorMode: 'highlight', highlight: ['2º tri'] },
      { type: 'bar', colorMode: 'highlight', highlight: ['Chás'] },
      { type: 'bar', colorMode: 'gradient' },
      { type: 'bar', colorMode: 'none' },
      { type: 'bar', colorMode: 'single', singleColor: '#884422' },
      { type: 'bar', patterns: true },
      { type: 'bar', valAxis: { ...DEFAULT_CONFIG.valAxis, log: true, min: 1000, title: 'R$' } },
      { type: 'bar', legend: { show: true, position: 'right' } },
      { type: 'bar', legend: { show: true, position: 'bottom' }, background: 'custom', backgroundColor: '#102030' },
      { type: 'heatmap', labels: { ...DEFAULT_CONFIG.labels, show: true } },
      { type: 'radar', labels: { ...DEFAULT_CONFIG.labels, show: true } },
    ];
    for (const v of variants) {
      expect(render(config(v), tsv).svg, JSON.stringify(v)).toContain('<svg');
      expect(render(config(v), tsv, true).svg, JSON.stringify(v)).toContain('<svg');
    }
  });

  it('mostra o total no centro da rosca', () => {
    const { svg } = render(config({ type: 'donut' }), SAMPLES[1].tsv);
    expect(svg).toContain('Total');
    expect(svg).toContain('13.165');
  });

  it('cascata soma até o total', () => {
    const { svg } = render(config({ type: 'waterfall', labels: { ...DEFAULT_CONFIG.labels, show: true } }), SAMPLES[3].tsv);
    expect(svg).toContain('302');
    expect(svg).toContain('−187'.replace('−', '-'));
  });

  it('avisa quando o tipo usa uma série só', () => {
    const { notes } = render(config({ type: 'pie' }), SAMPLES[0].tsv);
    expect(notes.join(' ')).toMatch(/uma série só/);
  });

  it('usa porcentagem automaticamente quando os dados vêm em %', () => {
    const { svg } = render(config({ type: 'bar', labels: { ...DEFAULT_CONFIG.labels, show: true } }), SAMPLES[4].tsv);
    expect(svg).toMatch(/81\s?%/);
  });
});

describe('format', () => {
  const base = DEFAULT_CONFIG.number;
  it('formata em pt-BR', () => {
    expect(makeFormatter({ ...base, style: 'number', decimals: 2 }, [1])(1234.5)).toBe('1.234,50');
    expect(makeFormatter({ ...base, style: 'currency' }, [1])(10)).toMatch(/R\$\s?10,00/);
    expect(makeFormatter({ ...base, style: 'percent' }, [0.123])(0.123)).toMatch(/12,3\s?%/);
    expect(makeFormatter({ ...base, style: 'compact' }, [1])(1_250_000)).toMatch(/1,3\s?mi/);
    expect(makeFormatter({ ...base, prefix: '~', suffix: ' un.' }, [1])(5)).toBe('~5 un.');
  });
});
