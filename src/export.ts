import { echarts, LOCALE } from './chart/echarts';
import { buildOption } from './chart/buildOption';
import type { ChartConfig } from './chart/config';
import type { Dataset } from './data/types';

export interface LogicalSize {
  width: number;
  height: number;
}

/** Tamanho lógico (em px de tela) de cada formato. A imagem final multiplica pela escala. */
export const SIZE_PRESETS: Record<string, { name: string; width: number; height: number }> = {
  '16:9': { name: 'Slide 16:9', width: 960, height: 540 },
  '4:3': { name: 'Slide 4:3', width: 880, height: 660 },
  '1:1': { name: 'Quadrado', width: 720, height: 720 },
  '9:16': { name: 'Stories 9:16', width: 540, height: 960 },
  a4: { name: 'A4 paisagem', width: 1123, height: 794 },
};

export function logicalSize(cfg: ChartConfig, stage: LogicalSize): LogicalSize {
  if (cfg.size.preset === 'fit') return stage;
  if (cfg.size.preset === 'custom') {
    return { width: clamp(cfg.size.width, 200, 4000), height: clamp(cfg.size.height, 150, 4000) };
  }
  return SIZE_PRESETS[cfg.size.preset] ?? stage;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));
}

export type ExportFormat = 'png' | 'jpg' | 'svg';

export interface ExportRequest {
  dataset: Dataset;
  config: ChartConfig;
  size: LogicalSize;
  uiDark: boolean;
  format: ExportFormat;
  transparent: boolean;
}

function exportConfig(req: ExportRequest): ChartConfig {
  return {
    ...req.config,
    animation: false,
    background: req.transparent && req.format !== 'jpg' ? 'transparent' : req.config.background,
  };
}

export async function renderImage(req: ExportRequest): Promise<Blob> {
  const { width, height } = req.size;
  const cfg = exportConfig(req);
  if ('fonts' in document) await document.fonts.ready;

  if (req.format === 'svg') {
    const built = buildOption(req.dataset, cfg, { width, height, uiDark: req.uiDark, reducedMotion: true });
    const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width, height, locale: LOCALE });
    chart.setOption(built.option);
    const svg = chart.renderToSVGString();
    chart.dispose();
    return new Blob([svg], { type: 'image/svg+xml' });
  }

  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;pointer-events:none;`;
  document.body.appendChild(host);
  try {
    const scale = clamp(req.config.exportScale, 1, 4);
    const chart = echarts.init(host, null, { renderer: 'canvas', width, height, devicePixelRatio: scale, locale: LOCALE });
    const built = buildOption(req.dataset, cfg, { width, height, uiDark: req.uiDark, reducedMotion: true });
    chart.setOption(built.option);
    const bg = built.background === 'transparent' ? (req.format === 'jpg' ? '#ffffff' : 'transparent') : built.background;
    const url = chart.getDataURL({ type: req.format === 'jpg' ? 'jpeg' : 'png', pixelRatio: scale, backgroundColor: bg });
    chart.dispose();
    return dataUrlToBlob(url);
  } finally {
    host.remove();
  }
}

function dataUrlToBlob(url: string): Blob {
  const [head, body] = url.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'application/octet-stream';
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// ---------------------------------------------------------------------------
// Salvar arquivo: dentro do claude.ai usa a permissão de download; fora, um link comum.

interface DownloadsCapability {
  save(req: { filename: string; data: Blob | string }): Promise<unknown>;
}

let downloadsPromise: Promise<DownloadsCapability | null> | null = null;

/** Pede a capacidade de download cedo, para o clique não esperar. */
export function prepareDownloads(): void {
  const claude = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
  if (!claude?.use || downloadsPromise) return;
  downloadsPromise = claude
    .use('downloads')
    .then((d) => (d as DownloadsCapability | null) ?? null)
    .catch(() => null);
}

/** 'unsure': o link de download foi acionado, mas a página está num quadro que pode bloqueá-lo. */
export type SaveResult = 'saved' | 'declined' | 'failed' | 'unsure';

export async function saveFile(filename: string, data: Blob): Promise<SaveResult> {
  let framed = false;
  if (downloadsPromise) {
    framed = true;
    const downloads = await downloadsPromise;
    if (downloads) {
      try {
        await downloads.save({ filename, data });
        return 'saved';
      } catch (e) {
        const code = (e as { code?: string })?.code;
        return code === 'declined' ? 'declined' : 'failed';
      }
    }
  }
  try {
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return framed ? 'unsure' : 'saved';
  } catch {
    return 'failed';
  }
}

export async function copyImage(blobPromise: Promise<Blob>): Promise<boolean> {
  try {
    if (!('ClipboardItem' in window) || !navigator.clipboard?.write) return false;
    // O Safari exige que o ClipboardItem seja criado dentro do clique, com uma promessa.
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })]);
    return true;
  } catch {
    return false;
  }
}

export function safeFileName(title: string, ext: string): string {
  const base =
    title
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9 _-]+/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 60) || 'grafico';
  return `${base}.${ext}`;
}
