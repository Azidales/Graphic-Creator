import type { ReactNode } from 'react';

const g = (children: ReactNode) => (
  <svg viewBox="0 0 40 28" fill="none" aria-hidden="true" focusable="false">
    {children}
  </svg>
);

const A = 'var(--accent)';

/** Miniaturas dos tipos de gráfico (desenhadas à mão, 40×28). */
export const TYPE_ICONS: Record<string, ReactNode> = {
  column: g(
    <>
      <path d="M4 25h32" stroke="currentColor" strokeOpacity=".4" />
      <rect x="7" y="13" width="5" height="12" rx="1" fill="currentColor" fillOpacity=".55" />
      <rect x="15" y="6" width="5" height="19" rx="1" fill={A} />
      <rect x="23" y="10" width="5" height="15" rx="1" fill="currentColor" fillOpacity=".55" />
      <rect x="31" y="16" width="4" height="9" rx="1" fill="currentColor" fillOpacity=".55" />
    </>,
  ),
  barh: g(
    <>
      <path d="M5 3v23" stroke="currentColor" strokeOpacity=".4" />
      <rect x="5" y="4" width="28" height="4.5" rx="1" fill={A} />
      <rect x="5" y="11.5" width="20" height="4.5" rx="1" fill="currentColor" fillOpacity=".55" />
      <rect x="5" y="19" width="13" height="4.5" rx="1" fill="currentColor" fillOpacity=".55" />
    </>,
  ),
  line: g(
    <>
      <path d="M4 25h32" stroke="currentColor" strokeOpacity=".4" />
      <path d="M5 20l8-7 7 4 7-10 8 5" stroke={A} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 23l8-3 7 1 7-5 8 1" stroke="currentColor" strokeOpacity=".5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </>,
  ),
  area: g(
    <>
      <path d="M5 19l8-7 7 4 7-10 8 5v14H5z" fill={A} fillOpacity=".25" />
      <path d="M5 19l8-7 7 4 7-10 8 5" stroke={A} strokeWidth="2" strokeLinejoin="round" />
      <path d="M4 25h32" stroke="currentColor" strokeOpacity=".4" />
    </>,
  ),
  combo: g(
    <>
      <path d="M4 25h32" stroke="currentColor" strokeOpacity=".4" />
      <rect x="7" y="14" width="5" height="11" rx="1" fill="currentColor" fillOpacity=".45" />
      <rect x="16" y="10" width="5" height="15" rx="1" fill="currentColor" fillOpacity=".45" />
      <rect x="25" y="12" width="5" height="13" rx="1" fill="currentColor" fillOpacity=".45" />
      <path d="M9.5 10l9-5 9 3 7-4" stroke={A} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>,
  ),
  pie: g(
    <>
      <circle cx="20" cy="14" r="11" fill="currentColor" fillOpacity=".45" />
      <path d="M20 14V3a11 11 0 0 1 10.5 14.3z" fill={A} />
    </>,
  ),
  donut: g(
    <>
      <circle cx="20" cy="14" r="9" stroke="currentColor" strokeOpacity=".45" strokeWidth="5" />
      <path d="M20 5a9 9 0 0 1 8.6 11.7" stroke={A} strokeWidth="5" />
    </>,
  ),
  scatter: g(
    <>
      <path d="M5 3v22h31" stroke="currentColor" strokeOpacity=".4" />
      {[
        [10, 19],
        [13, 15],
        [17, 17],
        [20, 11],
        [24, 12],
        [27, 7],
        [31, 8],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.2" fill={i % 3 === 0 ? A : 'currentColor'} fillOpacity={i % 3 === 0 ? 1 : 0.55} />
      ))}
    </>,
  ),
  lollipop: g(
    <>
      <path d="M4 25h32" stroke="currentColor" strokeOpacity=".4" />
      {[
        [9, 14],
        [17, 6],
        [25, 11],
        [33, 17],
      ].map(([x, y], i) => (
        <g key={i}>
          <path d={`M${x} 25V${y}`} stroke={i === 1 ? A : 'currentColor'} strokeOpacity={i === 1 ? 1 : 0.55} strokeWidth="1.6" />
          <circle cx={x} cy={y} r="2.8" fill={i === 1 ? A : 'currentColor'} fillOpacity={i === 1 ? 1 : 0.55} />
        </g>
      ))}
    </>,
  ),
  dumbbell: g(
    <>
      {[
        [9, 26, 5],
        [14, 30, 14],
        [7, 20, 23],
      ].map(([a, b, y], i) => (
        <g key={i}>
          <path d={`M${a} ${y}H${b}`} stroke="currentColor" strokeOpacity=".35" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx={a} cy={y} r="2.8" fill="currentColor" fillOpacity=".55" />
          <circle cx={b} cy={y} r="2.8" fill={A} />
        </g>
      ))}
    </>,
  ),
  waterfall: g(
    <>
      <path d="M4 25h32" stroke="currentColor" strokeOpacity=".4" />
      <rect x="5" y="6" width="5" height="19" rx="1" fill={A} />
      <rect x="12" y="6" width="5" height="6" rx="1" fill="currentColor" fillOpacity=".55" />
      <rect x="19" y="12" width="5" height="5" rx="1" fill="currentColor" fillOpacity=".55" />
      <rect x="26" y="9" width="5" height="3" rx="1" fill={A} fillOpacity=".6" />
      <rect x="33" y="9" width="4" height="16" rx="1" fill="currentColor" />
    </>,
  ),
  radar: g(
    <>
      <path d="M20 2l11 8-4 14H13L9 10z" stroke="currentColor" strokeOpacity=".4" />
      <path d="M20 6l8 5-4 10h-7l-5-9z" fill={A} fillOpacity=".3" stroke={A} strokeWidth="1.6" strokeLinejoin="round" />
    </>,
  ),
  funnel: g(
    <>
      <rect x="5" y="3" width="30" height="5" rx="1" fill={A} />
      <rect x="9" y="10" width="22" height="5" rx="1" fill={A} fillOpacity=".7" />
      <rect x="13" y="17" width="14" height="4" rx="1" fill={A} fillOpacity=".45" />
      <rect x="16" y="23" width="8" height="3" rx="1" fill={A} fillOpacity=".3" />
    </>,
  ),
  treemap: g(
    <>
      <rect x="4" y="3" width="18" height="22" rx="1.5" fill={A} />
      <rect x="24" y="3" width="12" height="12" rx="1.5" fill="currentColor" fillOpacity=".55" />
      <rect x="24" y="17" width="6" height="8" rx="1.5" fill="currentColor" fillOpacity=".4" />
      <rect x="32" y="17" width="4" height="8" rx="1.5" fill="currentColor" fillOpacity=".25" />
    </>,
  ),
  heatmap: g(
    <>
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3, 4].map((c) => (
          <rect key={`${r}-${c}`} x={4 + c * 6.6} y={3 + r * 7.6} width="5.6" height="6.6" rx="1" fill={A} fillOpacity={0.15 + ((r * 5 + c * 3) % 9) / 10} />
        )),
      )}
    </>,
  ),
};

const ui = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {d}
  </svg>
);

export const Icon = {
  undo: ui(<path d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" />),
  redo: ui(<path d="M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3" />),
  upload: ui(<path d="M12 16V4m0 0L7 9m5-5l5 5M5 20h14" />),
  download: ui(<path d="M12 4v12m0 0l-5-5m5 5l5-5M5 20h14" />),
  copy: ui(
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a1 1 0 0 1 1-1h9" />
    </>,
  ),
  paste: ui(
    <>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4V3h6v1M9 10h6M9 14h6" />
    </>,
  ),
  swap: ui(<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />),
  warn: ui(<path d="M12 3l10 18H2zM12 10v5M12 18v.01" />),
  table: ui(
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M3 15h18M9 4v16" />
    </>,
  ),
  save: ui(<path d="M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6" />),
  trash: ui(<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />),
  reset: ui(<path d="M4 4v6h6M4.5 15a8 8 0 1 0 2-8.5L4 10" />),
};
