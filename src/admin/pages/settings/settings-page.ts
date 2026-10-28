import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgSelectComponent } from '@ng-select/ng-select';
import { CompanySettings, Faq, Office } from '../../../app/core/models';
import { ContentStore } from '../../../app/core/services/content-store';
import { normaliseWhatsappNumber } from '../../../app/core/services/whatsapp.service';
import { formatInr, roundMoney } from '../../../app/core/utils/price';
import { assetUrl } from '../../../app/core/utils/url';
import { AdminAlerts } from '../../core/alerts.service';
import { resizeToWebp } from '../../core/image-resize';
import { NumbersOnlyDirective } from '../../core/numbers-only.directive';
import { Icon } from '../../../app/shared/icons';
import { AdminCard } from '../../shared/admin-card';

const EXAMPLE_TRIP_PRICE = 50000;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const STATES = [
  'Delhi',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Ladakh',
  'Punjab',
  'Rajasthan',
  'Uttar Pradesh',
  'Uttarakhand',
  'Karnataka',
  'Kerala',
  'Maharashtra',
  'Tamil Nadu',
  'Telangana',
  'West Bengal',
];

@Component({
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, NgSelectComponent, NumbersOnlyDirective, AdminCard, Icon],
  templateUrl: './settings-page.html',
  styles: `
    /* read-only worked example, tinted so it doesn't look like a field */
    .payment-summary {
      color: #e2e8f0;
      background: linear-gradient(135deg, #12204a 0%, #1e3a6e 100%);
    }
    .payment-summary .text-body-secondary {
      color: #9fb0cc !important;
    }
    .payment-summary .total {
      padding-block: 0.4rem;
      margin-bottom: 0.4rem;
      font-size: 1rem;
      font-weight: 700;
      color: #fbbf24;
      border-block: 1px solid rgba(255, 255, 255, 0.15);
    }
  `,
})
export class SettingsPage implements OnInit {
  private readonly store = inject(ContentStore);
  private readonly fb = inject(FormBuilder);
  private readonly alerts = inject(AdminAlerts);

  readonly states = STATES;
  readonly submitted = signal(false);

  readonly form = this.fb.nonNullable.group({
    companyName: ['', Validators.required],
    tagline: [''],
    description: [''],
    whatsappNumber: ['', Validators.pattern(/^\d{10,15}$/)],
    phone: [''],
    email: ['', Validators.email],
    officeHours: [''],
    instagram: [''],
    youtube: [''],
    facebook: [''],
    gstPercent: this.fb.control<string | number>(5, Validators.required),
    advancePercent: this.fb.control<string | number>(30, Validators.required),
    balanceDueDays: this.fb.control<string | number>(21, Validators.required),
    holdHours: this.fb.control<string | number>(48, Validators.required),
    offices: this.fb.array<ReturnType<SettingsPage['officeGroup']>>([]),
    faqs: this.fb.array<ReturnType<SettingsPage['faqGroup']>>([]),
  });

  // Worked example under "Payments and holds", using the same maths as the booking page.
  private readonly paymentValues = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  readonly example = computed(() => {
    const v = this.paymentValues();
    const gstPercent = Number(v.gstPercent) || 0;
    const advancePercent = Math.min(100, Number(v.advancePercent) || 0);
    const price = EXAMPLE_TRIP_PRICE;
    const gst = roundMoney((price * gstPercent) / 100);
    const total = roundMoney(price + gst);
    const advance = Math.min(total, Math.ceil((total * advancePercent) / 100));
    return {
      gstPercent,
      advancePercent,
      balanceDueDays: Number(v.balanceDueDays) || 0,
      holdHours: Number(v.holdHours) || 0,
      price,
      gst,
      total,
      advance,
      balance: roundMoney(total - advance),
    };
  });
  readonly formatInr = formatInr;

  // uploaded data URL or a path; empty means the default favicon.svg
  readonly logo = signal('');
  readonly assetUrl = assetUrl;

  async uploadLogo(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    // SVGs stay as they are (sharp at any size); photos are shrunk to keep settings.json small
    this.logo.set(
      file.type === 'image/svg+xml' ? await readAsDataUrl(file) : await resizeToWebp(file, 256),
    );
  }

  private officeGroup(o?: Office) {
    return this.fb.nonNullable.group({
      name: [o?.name ?? '', Validators.required],
      address: [o?.address ?? ''],
      city: [o?.city ?? ''],
      state: this.fb.control<string | null>(o?.state || null),
      postalCode: [o?.postalCode ?? ''],
      phone: [o?.phone ?? ''],
      hours: [o?.hours ?? ''],
      mapQuery: [o?.mapQuery ?? ''],
    });
  }

  private faqGroup(faq: Faq = { question: '', answer: '' }) {
    return this.fb.nonNullable.group({ question: [faq.question], answer: [faq.answer] });
  }

  ngOnInit(): void {
    const s = this.store.settings();
    if (!s) return;
    // testimonials are not edited here for now; save() keeps the stored ones
    const { offices, faqs, testimonials: _testimonials, ...plain } = s;
    this.logo.set(s.logo ?? '');
    this.form.patchValue(plain);
    offices.forEach((o) => this.form.controls.offices.push(this.officeGroup(o)));
    faqs.forEach((f) => this.form.controls.faqs.push(this.faqGroup(f)));
  }

  addOffice(): void {
    this.form.controls.offices.push(this.officeGroup());
  }

  async removeOffice(i: number): Promise<void> {
    const name = this.form.controls.offices.at(i).controls.name.value.trim() || 'this office';
    const ok = await this.alerts.confirmDelete(
      `Remove ${name}?`,
      'It is removed from the contact page and footer when you save and publish.',
    );
    if (ok) this.form.controls.offices.removeAt(i);
  }

  async removeFaq(i: number): Promise<void> {
    const question = this.form.controls.faqs.at(i).controls.question.value.trim();
    const ok = await this.alerts.confirmDelete(
      'Remove this question?',
      question || 'It is removed from the home page when you save and publish.',
    );
    if (ok) this.form.controls.faqs.removeAt(i);
  }

  addFaq(): void {
    this.form.controls.faqs.push(this.faqGroup());
  }

  invalid(name: 'companyName' | 'whatsappNumber' | 'email'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || this.submitted());
  }

  async save(): Promise<void> {
    this.submitted.set(true);
    if (this.form.invalid) {
      void this.alerts.error(
        'Please check the form',
        'Some fields need attention. Each office requires a name.',
      );
      return;
    }
    if (
      !(await this.alerts.confirm(
        'Save company settings?',
        'The website updates right away in this browser.',
      ))
    )
      return;
    const v = this.form.getRawValue();
    const settings: CompanySettings = {
      ...v,
      logo: this.logo(),
      description: v.description.trim(),
      whatsappNumber: normaliseWhatsappNumber(v.whatsappNumber),
      offices: v.offices
        .filter((o) => o.name.trim())
        .map((o) => ({ ...o, name: o.name.trim(), state: o.state ?? '' })),
      gstPercent: Number(v.gstPercent) || 0,
      advancePercent: Math.min(100, Number(v.advancePercent) || 0),
      balanceDueDays: Number(v.balanceDueDays) || 0,
      holdHours: Number(v.holdHours) || 0,
      faqs: v.faqs.filter((f) => f.question.trim() && f.answer.trim()),
      testimonials: this.store.settings()?.testimonials ?? [],
    };
    this.store.saveDraft('settings', settings);
    this.form.markAsPristine();
    void this.alerts.success('Settings saved', 'Publish them to make them live.');
  }
}
