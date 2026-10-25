import {
  AllCommunityModule,
  ICellRendererParams,
  ModuleRegistry,
  themeQuartz,
} from 'ag-grid-community';
import { assetUrl } from '../../app/core/utils/url';

ModuleRegistry.registerModules([AllCommunityModule]);

export const adminGridTheme = themeQuartz.withParams({
  accentColor: '#1e5aa8',
  fontFamily: 'Inter, system-ui, sans-serif',
  headerBackgroundColor: '#f4f6fa',
  headerFontWeight: 600,
  borderColor: '#e2e8f0',
  wrapperBorder: false,
  wrapperBorderRadius: 0,
  // match the form checkboxes in admin-styles.scss
  checkboxBorderRadius: 5,
  checkboxCheckedBackgroundColor: '#1e5aa8',
  checkboxCheckedBorderColor: '#1e5aa8',
  checkboxUncheckedBorderColor: '#cbd5e1',
});

export interface RowButton<T> {
  label: string;
  className: string;
  onClick: (row: T) => void;
}

// Buttons for the actions column. `buttonsFor` can return different buttons per row.
export function rowButtons<T>(buttonsFor: (row: T) => RowButton<T>[]) {
  return (p: ICellRendererParams<T>) => {
    const wrap = document.createElement('div');
    wrap.className = 'd-flex gap-1 align-items-center h-100';
    if (!p.data) return wrap;
    const row = p.data;

    for (const button of buttonsFor(row)) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `btn btn-sm ${button.className}`;
      el.textContent = button.label;
      el.onclick = () => button.onClick(row);
      wrap.append(el);
    }
    return wrap;
  };
}

export function actionButtons<T>(onEdit: (row: T) => void, onDelete: (row: T) => void) {
  return rowButtons<T>(() => [
    { label: 'Edit', className: 'btn-outline-primary', onClick: onEdit },
    { label: 'Delete', className: 'btn-outline-danger', onClick: onDelete },
  ]);
}

export function thumbnail(shape: 'square' | 'round' = 'square') {
  return (p: ICellRendererParams) => {
    const img = document.createElement('img');
    img.src = p.value ? assetUrl(String(p.value)) : '';
    img.alt = '';
    img.loading = 'lazy';
    img.className = shape === 'round' ? 'grid-thumb rounded-circle' : 'grid-thumb';
    return img;
  };
}

// On phones a pinned column takes too much room, so only pin on wider screens.
export function pinRightOnWideScreens(): 'right' | null {
  return matchMedia('(min-width: 768px)').matches ? 'right' : null;
}

export function badge(colors: Record<string, string>) {
  return (p: ICellRendererParams) => {
    if (p.value === null || p.value === undefined || p.value === '') return '';
    const span = document.createElement('span');
    span.className = `badge rounded-pill text-bg-${colors[String(p.value)] ?? 'secondary'}`;
    span.textContent = String(p.value);
    return span;
  };
}

// e.g. 24 Oct 2026, 8:25 pm
export const formatDateTime = (iso: string | null | undefined): string =>
  iso
    ? new Date(iso).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

export const formatDate = (iso: string | null | undefined): string =>
  iso
    ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';
