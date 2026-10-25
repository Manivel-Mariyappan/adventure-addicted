import { Injectable } from '@angular/core';
import { NgbDateParserFormatter, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';

// Datepicker format: dd-mm-yyyy
@Injectable()
export class DmyDateFormatter extends NgbDateParserFormatter {
  parse(value: string): NgbDateStruct | null {
    const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(value.trim());
    return m ? { day: Number(m[1]), month: Number(m[2]), year: Number(m[3]) } : null;
  }

  format(date: NgbDateStruct | null): string {
    if (!date) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(date.day)}-${pad(date.month)}-${date.year}`;
  }
}
