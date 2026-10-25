import { Directive, ElementRef, inject, input } from '@angular/core';
import { NgControl } from '@angular/forms';

// Usage: <input appNumbersOnly [decimals]="2">
// Blocks letters while typing and cleans up pasted text.
@Directive({
  selector: 'input[appNumbersOnly]',
  host: {
    inputmode: 'decimal',
    autocomplete: 'off',
    '(keydown)': 'onKeydown($event)',
    '(input)': 'onInput()',
  },
})
export class NumbersOnlyDirective {
  // 0 = whole numbers only
  readonly decimals = input(2);

  private readonly el = inject(ElementRef<HTMLInputElement>);
  private readonly control = inject(NgControl, { optional: true, self: true });

  private static readonly ALLOWED_KEYS = new Set([
    'Backspace',
    'Delete',
    'Tab',
    'Escape',
    'Enter',
    'ArrowLeft',
    'ArrowRight',
    'Home',
    'End',
  ]);

  onKeydown(e: KeyboardEvent): void {
    if (NumbersOnlyDirective.ALLOWED_KEYS.has(e.key) || e.ctrlKey || e.metaKey) return;
    const value = (this.el.nativeElement as HTMLInputElement).value;
    if (e.key === '.' && this.decimals() > 0 && !value.includes('.')) return;
    if (/^\d$/.test(e.key)) return;
    e.preventDefault();
  }

  onInput(): void {
    const input = this.el.nativeElement as HTMLInputElement;
    const clean = this.sanitize(input.value);
    if (clean !== input.value) input.value = clean;
    // The forms value accessor also listens to (input), so set the cleaned value ourselves.
    this.control?.control?.setValue(clean, { emitModelToViewChange: false });
  }

  private sanitize(raw: string): string {
    const allowDecimal = this.decimals() > 0;
    const onlyNumberChars = raw.replace(allowDecimal ? /[^\d.]/g : /\D/g, '');

    const dot = onlyNumberChars.indexOf('.');
    if (dot === -1) return onlyNumberChars;

    const wholePart = onlyNumberChars.slice(0, dot);
    const decimalPart = onlyNumberChars
      .slice(dot + 1)
      .replace(/\./g, '') // drop any extra decimal points
      .slice(0, this.decimals());
    return `${wholePart}.${decimalPart}`;
  }
}
