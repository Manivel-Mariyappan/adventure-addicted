import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NumbersOnlyDirective } from './numbers-only.directive';

@Component({
  imports: [ReactiveFormsModule, NumbersOnlyDirective],
  template: `
    <input id="rate" [formControl]="rate" appNumbersOnly [decimals]="2" />
    <input id="pin" [formControl]="pin" appNumbersOnly [decimals]="0" />
  `,
})
class Host {
  rate = new FormControl<string | null>(null);
  pin = new FormControl<string | null>(null);
}

describe('NumbersOnlyDirective', () => {
  function typeInto(id: string, text: string) {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    return { input, host: fixture.componentInstance };
  }

  it('removes letters and extra decimal points, keeping two decimals', () => {
    const { input, host } = typeInto('rate', '7a1b5.5.3');
    expect(input.value).toBe('715.53');
    expect(host.rate.value).toBe('715.53');
  });

  it('limits the number of decimals', () => {
    const { input } = typeInto('rate', '7150.456');
    expect(input.value).toBe('7150.45');
  });

  it('allows whole numbers only when decimals is 0', () => {
    const { input, host } = typeInto('pin', '63-6.00x1');
    expect(input.value).toBe('636001');
    expect(host.pin.value).toBe('636001');
  });
});
