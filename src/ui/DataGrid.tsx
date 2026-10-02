import { useState } from 'react';
import { columnLetter } from '../data/dataset';
import { cellToNumber } from '../data/numbers';
import type { Cell, DataSettings, Dataset, Grid } from '../data/types';

interface Props {
  grid: Grid;
  settings: DataSettings;
  dataset: Dataset;
  colorOf: (field: number) => string | null;
  onFieldClick: (field: number) => void;
  onEdit: (row: number, col: number, value: string) => void;
}

const MAX_ROWS = 200;
const MAX_COLS = 40;

function display(c: Cell): string {
  if (c === null) return '';
  if (typeof c === 'number') return c.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
  return c;
}

export function DataGrid({ grid, settings, dataset, colorOf, onFieldClick, onEdit }: Props) {
  const [editing, setEditing] = useState<{ r: number; c: number } | null>(null);
  const byCols = settings.orientation === 'columns';
  const header = dataset.headerUsed;
  const width = Math.max(0, ...grid.map((r) => r.length));
  const rows = grid.slice(0, MAX_ROWS);
  const cols = Math.min(width, MAX_COLS);
  const seriesFields = new Set(dataset.series.map((s) => s.field));
  const fieldOf = (r: number, c: number) => (byCols ? c : r);
  const isHeaderCell = (r: number, c: number) => header && (byCols ? r === 0 : c === 0);
  const fieldInfo = (f: number) => dataset.fields[f];

  const roleFor = (f: number) => {
    if (f === dataset.categoryField) return 'category';
    if (seriesFields.has(f)) return 'series';
    return 'off';
  };

  const headButton = (f: number, label: string) => {
    const role = roleFor(f);
    const info = fieldInfo(f);
    const color = role === 'series' ? colorOf(f) : null;
    const title =
      role === 'category'
        ? `${info?.name ?? label}: categorias do gráfico`
        : info?.numeric
          ? `${info.name}: clique para ${role === 'series' ? 'tirar do' : 'pôr no'} gráfico`
          : `${info?.name ?? label}: clique para usar como categorias`;
    return (
      <button type="button" onClick={() => onFieldClick(f)} title={title}>
        <span>{label}</span>
        {role === 'category' ? <span className="role-tag">cat.</span> : null}
        {color ? <span className="role-dot" style={{ background: color }} aria-label="série no gráfico" /> : null}
      </button>
    );
  };

  return (
    <div className="grid-scroll">
      <table className="sheet-table">
        <thead>
          <tr>
            <th className="corner" scope="col">
              <span className="visually-hidden">Linha</span>
            </th>
            {Array.from({ length: cols }, (_, c) => (
              <th key={c} className="colhead" scope="col">
                {byCols ? headButton(c, columnLetter(c)) : <span style={{ padding: '0 8px' }}>{columnLetter(c)}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              <th scope="row" className="rowhead">
                {byCols ? r + 1 : headButton(r, String(r + 1))}
              </th>
              {Array.from({ length: cols }, (_, c) => {
                const cell = row[c] ?? null;
                const f = fieldOf(r, c);
                const role = roleFor(f);
                const isHead = isHeaderCell(r, c);
                const numeric = cellToNumber(cell, dataset.decimalUsed) !== null;
                const cls = [
                  isHead ? 'is-header' : '',
                  !isHead && role === 'category' ? 'is-category' : '',
                  !isHead && role === 'off' ? 'is-off' : '',
                  numeric && !isHead ? 'num' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                const isEditing = editing?.r === r && editing?.c === c;
                return (
                  <td key={c} className={cls}>
                    {isEditing ? (
                      <input
                        className="cell-edit"
                        autoFocus
                        defaultValue={typeof cell === 'number' ? String(cell).replace('.', ',') : (cell ?? '')}
                        aria-label={`Editar ${columnLetter(c)}${r + 1}`}
                        onBlur={(e) => {
                          if (e.target.value !== display(cell)) onEdit(r, c, e.target.value);
                          setEditing(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          if (e.key === 'Escape') setEditing(null);
                        }}
                      />
                    ) : (
                      <button type="button" className="cell" title={`${columnLetter(c)}${r + 1}: clique para editar`} onClick={() => setEditing({ r, c })}>
                        {display(cell) || ' '}
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {grid.length > MAX_ROWS || width > MAX_COLS ? (
        <div className="grid-foot">
          Mostrando {Math.min(grid.length, MAX_ROWS)} de {grid.length} linhas e {cols} de {width} colunas. O gráfico usa a tabela inteira.
        </div>
      ) : null}
    </div>
  );
}
