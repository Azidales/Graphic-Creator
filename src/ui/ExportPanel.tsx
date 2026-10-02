import { useRef, useState } from 'react';
import type { ChartConfig, SizePreset } from '../chart/config';
import type { Dataset } from '../data/types';
import { SIZE_PRESETS, copyImage, renderImage, safeFileName, saveFile, type ExportFormat, type LogicalSize } from '../export';
import { applyTemplate, loadTemplates, saveTemplates, styleOnly, type Template } from '../state';
import { Field, NumberInput, Section, Segmented, Toggle } from './controls';
import { Icon } from './icons';

interface Props {
  config: ChartConfig;
  dataset: Dataset;
  uiDark: boolean;
  size: LogicalSize;
  setChart: (patch: Partial<ChartConfig> | ((c: ChartConfig) => Partial<ChartConfig>), key?: string) => void;
  toast: (msg: string) => void;
}

function datasetToCsv(ds: Dataset): string {
  const fmt = (v: number | null) => (v === null ? '' : String(v).replace('.', ','));
  const q = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const head = [ds.categoryName || 'Categoria', ...ds.series.map((s) => s.name)].map(q).join(';');
  const rows = ds.categories.map((c, i) => [q(c), ...ds.series.map((s) => fmt(s.values[i]))].join(';'));
  return '﻿' + [head, ...rows].join('\r\n');
}

export function ExportPanel({ config: c, dataset, uiDark, size, setChart, toast }: Props) {
  const [transparent, setTransparent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>(() => loadTemplates());
  const [tplName, setTplName] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  const finalW = Math.round(size.width * c.exportScale);
  const finalH = Math.round(size.height * c.exportScale);

  const run = async (format: ExportFormat) => {
    setBusy(true);
    try {
      const blob = await renderImage({ dataset, config: c, size, uiDark, format, transparent });
      const result = await saveFile(safeFileName(c.title || 'grafico', format), blob);
      if (result === 'saved') toast(`Imagem ${format.toUpperCase()} pronta`);
      else if (result === 'declined') toast('Download cancelado');
      else if (result === 'unsure') toast('Se o download não começar, use “Ver imagem” e salve com o botão direito.');
      else toast('Não foi possível baixar aqui. Use “Ver imagem” ou “Copiar imagem”.');
    } catch {
      toast('Não foi possível gerar a imagem.');
    } finally {
      setBusy(false);
    }
  };

  const showImage = async () => {
    setBusy(true);
    try {
      const blob = await renderImage({ dataset, config: c, size, uiDark, format: 'png', transparent });
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
    } catch {
      toast('Não foi possível gerar a imagem.');
    } finally {
      setBusy(false);
    }
  };

  const closePreview = () =>
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });

  const copy = async () => {
    const ok = await copyImage(renderImage({ dataset, config: c, size, uiDark, format: 'png', transparent }));
    toast(ok ? 'Imagem copiada: cole no PowerPoint, Word ou e-mail' : 'O navegador não deixou copiar. Use “Baixar PNG”.');
  };

  const persist = (list: Template[]) => {
    setTemplates(list);
    saveTemplates(list);
  };

  return (
    <>
      <Section title="Tamanho">
        <Field label="Formato">
          <div className="chips">
            {(
              [
                ['fit', 'Ajustar à tela'],
                ...Object.entries(SIZE_PRESETS).map(([k, v]) => [k, v.name]),
                ['custom', 'Personalizado'],
              ] as [SizePreset, string][]
            ).map(([k, name]) => (
              <button key={k} type="button" className="chip" aria-pressed={c.size.preset === k} onClick={() => setChart({ size: { ...c.size, preset: k } })}>
                {name}
              </button>
            ))}
          </div>
        </Field>
        {c.size.preset === 'custom' ? (
          <div className="row">
            <NumberInput label="Largura (px)" value={c.size.width} allowEmpty={false} onChange={(v) => setChart({ size: { ...c.size, width: Math.round(v ?? 960) } })} />
            <NumberInput label="Altura (px)" value={c.size.height} allowEmpty={false} onChange={(v) => setChart({ size: { ...c.size, height: Math.round(v ?? 540) } })} />
          </div>
        ) : null}
        <Segmented
          label="Resolução"
          value={c.exportScale}
          options={[
            { value: 1, label: '1×' },
            { value: 2, label: '2×' },
            { value: 3, label: '3×' },
            { value: 4, label: '4×' },
          ]}
          onChange={(v) => setChart({ exportScale: v })}
        />
        <span className="help">
          Imagem final: <b>{finalW} × {finalH} px</b>
          {c.size.preset === '16:9' && c.exportScale === 2 ? ' (Full HD)' : ''}
        </span>
      </Section>

      <Section title="Baixar e copiar">
        <Toggle label="Fundo transparente (PNG e SVG)" checked={transparent} onChange={setTransparent} />
        <div className="row">
          <button type="button" className="btn primary" disabled={busy} onClick={() => run('png')}>
            {Icon.download}
            PNG
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => run('svg')}>
            {Icon.download}
            SVG
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => run('jpg')}>
            {Icon.download}
            JPG
          </button>
          <button type="button" className="btn" disabled={busy} onClick={copy}>
            {Icon.copy}
            Copiar imagem
          </button>
          <button type="button" className="btn" disabled={busy} onClick={showImage}>
            Ver imagem
          </button>
        </div>
        <span className="help">PNG é o mais compatível. SVG é vetorial: fica nítido em qualquer tamanho. JPG sai sempre com fundo.</span>
        <button
          type="button"
          className="linkbtn"
          style={{ alignSelf: 'flex-start' }}
          onClick={async () => {
            const r = await saveFile(safeFileName(`${c.title || 'grafico'} dados`, 'csv'), new Blob([datasetToCsv(dataset)], { type: 'text/csv' }));
            toast(r === 'saved' ? 'Tabela do gráfico salva em CSV' : r === 'declined' ? 'Download cancelado' : 'Se o download não começar, este navegador bloqueou o arquivo.');
          }}
        >
          Baixar a tabela do gráfico (CSV, já agrupada e ordenada)
        </button>
      </Section>

      {preview ? (
        <div className="image-preview" role="dialog" aria-modal="true" aria-label="Imagem do gráfico" onClick={closePreview}>
          <div className="image-preview-box" onClick={(e) => e.stopPropagation()}>
            <img src={preview} alt={c.title || 'Gráfico'} />
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="help">Clique com o botão direito (ou toque e segure) na imagem para salvar ou copiar.</span>
              <button type="button" className="btn" onClick={closePreview} autoFocus>
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Section title="Meus estilos">
        <span className="help">Guarde o visual deste gráfico (cores, fontes, rótulos, eixos) para aplicar em outras tabelas.</span>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            const name = tplName.trim() || `Estilo ${templates.length + 1}`;
            persist([...templates.filter((t) => t.name !== name), { name, chart: styleOnly(c) }]);
            setTplName('');
            toast(`Estilo “${name}” salvo neste navegador`);
          }}
        >
          <div className="field" style={{ flex: '1 1 160px' }}>
            <label className="label" htmlFor="tpl-name">
              Nome do estilo
            </label>
            <input id="tpl-name" className="input" value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Ex.: Relatório mensal" />
          </div>
          <button type="submit" className="btn">
            {Icon.save}
            Salvar
          </button>
        </form>
        {templates.length ? (
          <div className="item-list">
            {templates.map((t) => (
              <div className="item" key={t.name}>
                <span className="name" style={{ flex: 1 }}>
                  {t.name}
                </span>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => {
                    setChart((cur) => applyTemplate(cur, t.chart));
                    toast(`Estilo “${t.name}” aplicado`);
                  }}
                >
                  Aplicar
                </button>
                <button type="button" className="btn small icon ghost" aria-label={`Apagar ${t.name}`} onClick={() => persist(templates.filter((x) => x.name !== t.name))}>
                  {Icon.trash}
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="row">
          <button
            type="button"
            className="btn small"
            onClick={async () => {
              const payload = JSON.stringify({ app: 'criador-de-graficos', version: 1, styles: templates.length ? templates : [{ name: 'Atual', chart: styleOnly(c) }] }, null, 2);
              const r = await saveFile('estilos-de-grafico.json', new Blob([payload], { type: 'application/json' }));
              if (r === 'saved') toast('Arquivo de estilos pronto');
              else if (r !== 'declined') toast('Se o download não começar, este navegador bloqueou o arquivo.');
            }}
          >
            {Icon.download}
            Exportar estilos
          </button>
          <button type="button" className="btn small" onClick={() => importRef.current?.click()}>
            {Icon.upload}
            Importar estilos
          </button>
          <input
            ref={importRef}
            type="file"
            hidden
            accept=".json,application/json"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                const parsed = JSON.parse(await f.text());
                const list: Template[] = (Array.isArray(parsed?.styles) ? parsed.styles : []).filter(
                  (t: unknown): t is Template => typeof (t as Template)?.name === 'string' && typeof (t as Template)?.chart === 'object',
                );
                if (!list.length) throw new Error('vazio');
                const names = new Set(list.map((t) => t.name));
                persist([...templates.filter((t) => !names.has(t.name)), ...list]);
                toast(`${list.length} estilo(s) importado(s)`);
              } catch {
                toast('Esse arquivo não tem estilos deste app.');
              }
            }}
          />
        </div>
      </Section>
    </>
  );
}
