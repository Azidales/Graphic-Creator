import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { echarts, LOCALE } from '../chart/echarts';
import { buildOption } from '../chart/buildOption';
import type { ChartConfig } from '../chart/config';
import type { Dataset } from '../data/types';
import { logicalSize, type LogicalSize } from '../export';
import { Icon } from './icons';

interface Props {
  dataset: Dataset;
  config: ChartConfig;
  uiDark: boolean;
  /** Avisa o tamanho lógico atual (usado na exportação do modo "ajustar à tela"). */
  onSize: (size: LogicalSize) => void;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

export function ChartView({ dataset, config, uiDark, onSize }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const chartEl = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof echarts.init> | null>(null);
  const [stage, setStage] = useState<LogicalSize>({ width: 800, height: 480 });
  const [notes, setNotes] = useState<string[]>([]);
  const [fontsReady, setFontsReady] = useState(0);
  const reduced = usePrefersReducedMotion();

  // Mede o palco.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const pad = 28;
      const width = Math.max(260, Math.floor(r.width - pad));
      const vh = window.innerHeight;
      const height = Math.max(300, Math.min(720, Math.round(Math.min(vh * 0.62, width * 0.68))));
      setStage((s) => (s.width === width && s.height === height ? s : { width, height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Fontes da web chegam depois: redesenha quando estiverem prontas.
  useEffect(() => {
    if ('fonts' in document) document.fonts.ready.then(() => setFontsReady((n) => n + 1));
  }, []);

  const size = logicalSize(config, stage);
  const fit = config.size.preset === 'fit';
  const availW = stage.width;
  const availH = fit ? stage.height : Math.max(300, Math.min(760, window.innerHeight * 0.7));
  const scale = fit ? 1 : Math.min(1, availW / size.width, availH / size.height);

  useEffect(() => onSize(size), [size.width, size.height]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cria / recria o gráfico quando o tamanho lógico muda.
  useEffect(() => {
    const el = chartEl.current;
    if (!el) return;
    const chart = echarts.init(el, null, { renderer: 'canvas', width: size.width, height: size.height, locale: LOCALE });
    chartRef.current = chart;
    return () => {
      chart.dispose();
      chartRef.current = null;
    };
  }, [size.width, size.height]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const built = buildOption(dataset, config, { width: size.width, height: size.height, uiDark, reducedMotion: reduced });
    chart.setOption(built.option, { notMerge: true });
    setNotes(built.notes);
  }, [dataset, config, uiDark, size.width, size.height, reduced, fontsReady]);

  return (
    <>
      <div ref={stageRef} className={`stage${fit ? ' fit' : ''}`}>
        <div
          className={`chart-frame${fit ? ' fit' : ''}`}
          style={{ width: Math.round(size.width * scale), height: Math.round(size.height * scale) }}
        >
          <div
            ref={chartEl}
            className="chart"
            role="img"
            aria-label={config.title ? `Gráfico: ${config.title}` : 'Gráfico'}
            style={{ width: size.width, height: size.height, transform: scale === 1 ? undefined : `scale(${scale})` }}
          />
        </div>
        {!fit ? (
          <span className="stage-meta">
            {size.width}×{size.height} · prévia {Math.round(scale * 100)}%
          </span>
        ) : null}
      </div>
      {notes.length ? (
        <div className="notes" aria-live="polite">
          {notes.map((n) => (
            <div className="note" key={n}>
              {Icon.warn}
              <span>{n}</span>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
