export interface Palette {
  id: string;
  name: string;
  light: string[];
  dark: string[];
}

// "Padrão" segue uma ordem validada para daltonismo (as cores vizinhas se distinguem
// nos três tipos mais comuns). As demais são alternativas de estilo.
export const PALETTES: Palette[] = [
  {
    id: 'padrao',
    name: 'Padrão acessível',
    light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
    dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
  },
  {
    id: 'okabe',
    name: 'Okabe-Ito (daltonismo)',
    light: ['#0072b2', '#e69f00', '#009e73', '#cc79a7', '#56b4e9', '#d55e00', '#f0e442', '#000000'],
    dark: ['#56b4e9', '#e69f00', '#009e73', '#cc79a7', '#0072b2', '#d55e00', '#f0e442', '#bbbbbb'],
  },
  {
    id: 'oceano',
    name: 'Oceano',
    light: ['#0b4f6c', '#01baef', '#20bf55', '#757575', '#2e86ab', '#7bdff2', '#0a2463', '#3e92cc'],
    dark: ['#2e86ab', '#01baef', '#20bf55', '#9e9e9e', '#7bdff2', '#3e92cc', '#5e7ce2', '#a3d5ff'],
  },
  {
    id: 'terra',
    name: 'Terra',
    light: ['#8c510a', '#bf812d', '#35978f', '#01665e', '#a6611a', '#dfc27d', '#543005', '#80cdc1'],
    dark: ['#bf812d', '#dfc27d', '#35978f', '#80cdc1', '#d8a35d', '#f6e8c3', '#c7eae5', '#5ab4ac'],
  },
  {
    id: 'pastel',
    name: 'Pastel',
    light: ['#8fb8de', '#f4a582', '#a1d99b', '#fdd49e', '#c9a0dc', '#f7b6d2', '#9edae5', '#d9d9d9'],
    dark: ['#8fb8de', '#f4a582', '#a1d99b', '#fdd49e', '#c9a0dc', '#f7b6d2', '#9edae5', '#d9d9d9'],
  },
  {
    id: 'vibrante',
    name: 'Vibrante',
    light: ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#9a6324'],
    dark: ['#ff5c7a', '#5ed36b', '#6f8cff', '#ff9f5a', '#c063e6', '#6be3ff', '#ff6bf2', '#c9925a'],
  },
  {
    id: 'cinzas',
    name: 'Tons de cinza',
    light: ['#262624', '#6b6a66', '#a3a29d', '#cfcec8', '#45443f', '#8a8984', '#bdbcb6', '#575651'],
    dark: ['#f2f2f0', '#b5b4ae', '#86857f', '#5c5b56', '#d6d5cf', '#9d9c96', '#706f6a', '#c4c3bd'],
  },
];

export interface SequentialRamp {
  id: string;
  name: string;
  from: string;
  to: string;
}

export const RAMPS: SequentialRamp[] = [
  { id: 'azul', name: 'Azul', from: '#cde2fb', to: '#0d366b' },
  { id: 'verde', name: 'Verde', from: '#d4f0dd', to: '#0b5a2e' },
  { id: 'laranja', name: 'Laranja', from: '#fde3cf', to: '#8a2c0b' },
  { id: 'roxo', name: 'Roxo', from: '#e6e1fa', to: '#2f2370' },
  { id: 'cinza', name: 'Cinza', from: '#ebebe8', to: '#262624' },
];

export function getPalette(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

export function getRamp(id: string): SequentialRamp {
  return RAMPS.find((r) => r.id === id) ?? RAMPS[0];
}

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

/** Mistura duas cores; t = 0 dá `a`, t = 1 dá `b`. */
export function mix(a: string, b: string, t: number): string {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  return rgbToHex([ra[0] + (rb[0] - ra[0]) * t, ra[1] + (rb[1] - ra[1]) * t, ra[2] + (rb[2] - ra[2]) * t]);
}

/** Luminância relativa (WCAG), para escolher texto claro ou escuro sobre uma cor. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function textOn(hex: string): string {
  return luminance(hex) > 0.4 ? '#0b0b0b' : '#ffffff';
}

/** n tons de uma cor, do mais escuro ao mais claro (modo monocromático). */
export function shades(base: string, n: number, dark: boolean): string[] {
  if (n <= 1) return [base];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    // Vai da cor base até uma versão bem clara (ou escura no tema escuro), sem chegar ao fundo.
    out.push(mix(base, dark ? '#101010' : '#ffffff', t * 0.72));
  }
  return out;
}

export function isHexColor(s: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s);
}
