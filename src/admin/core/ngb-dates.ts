import { NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';

// yyyy-mm-dd <-> the ng-bootstrap datepicker's {year, month, day}

export function toStruct(iso: string | null | undefined): NgbDateStruct | null {
  if (!iso) return null;
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return { year, month, day };
}

export function fromStruct(date: NgbDateStruct | null | undefined): string {
  if (!date) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
}
