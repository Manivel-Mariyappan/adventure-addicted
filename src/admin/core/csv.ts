// Downloads rows as a CSV file that opens in Excel (UTF-8 with BOM so ₹ shows correctly).
export function downloadCsv(filename: string, rows: Record<string, string | number>[]): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const cell = (value: string | number) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const csv = [
    headers.map(cell).join(','),
    ...rows.map((r) => headers.map((h) => cell(r[h])).join(',')),
  ].join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
