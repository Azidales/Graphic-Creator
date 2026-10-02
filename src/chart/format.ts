import type { NumberFormat } from './config';

const cache = new Map<string, Intl.NumberFormat>();

function nf(locale: string, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = locale + JSON.stringify(opts);
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, opts);
    cache.set(key, f);
  }
  return f;
}

/** Quantas casas decimais mostrar quando o usuário não escolheu. */
export function autoDecimals(values: number[]): number {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return 0;
  const maxAbs = Math.max(...finite.map(Math.abs));
  const hasFraction = finite.some((v) => Math.abs(v - Math.round(v)) > 1e-9);
  if (!hasFraction) return 0;
  if (maxAbs >= 1000) return 0;
  if (maxAbs >= 10) return 1;
  return 2;
}

export interface Formatter {
  (value: number | null | undefined): string;
}

/**
 * Cria a função que escreve os números no gráfico.
 * `sample` são os valores do gráfico, usados para decidir casas decimais automáticas.
 */
export function makeFormatter(fmt: NumberFormat, sample: number[], opts: { compactAuto?: boolean } = {}): Formatter {
  const locale = fmt.locale;
  const dec = fmt.decimals;
  let format: (v: number) => string;
  switch (fmt.style) {
    case 'compact': {
      const f = nf(locale, { notation: 'compact', maximumFractionDigits: dec ?? 1, minimumFractionDigits: dec ?? 0 });
      format = (v) => f.format(v);
      break;
    }
    case 'percent': {
      const auto = autoDecimals(sample.map((v) => v * 100));
      const f = nf(locale, { style: 'percent', maximumFractionDigits: dec ?? auto, minimumFractionDigits: dec ?? 0 });
      format = (v) => f.format(v);
      break;
    }
    case 'currency': {
      const f = nf(locale, {
        style: 'currency',
        currency: fmt.currency,
        maximumFractionDigits: dec ?? 2,
        minimumFractionDigits: dec ?? 2,
      });
      format = (v) => f.format(v);
      break;
    }
    case 'number': {
      const d = dec ?? autoDecimals(sample);
      const f = nf(locale, { maximumFractionDigits: d, minimumFractionDigits: d });
      format = (v) => f.format(v);
      break;
    }
    default: {
      const maxAbs = Math.max(0, ...sample.filter(Number.isFinite).map(Math.abs));
      if (opts.compactAuto && maxAbs >= 10000) {
        const f = nf(locale, { notation: 'compact', maximumFractionDigits: 1 });
        format = (v) => f.format(v);
      } else {
        const f = nf(locale, { maximumFractionDigits: dec ?? autoDecimals(sample) });
        format = (v) => f.format(v);
      }
    }
  }
  return (value) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return '';
    return `${fmt.prefix}${format(value)}${fmt.suffix}`;
  };
}

export function formatPercentShare(share: number, locale: string): string {
  return nf(locale, { style: 'percent', maximumFractionDigits: share < 0.1 ? 1 : 0 }).format(share);
}
