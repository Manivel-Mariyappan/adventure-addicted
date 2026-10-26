import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgSelectComponent } from '@ng-select/ng-select';
import { CompanySettings, Faq, Office, Testimonial } from '../../../app/core/models';
import { ContentStore } from '../../../app/core/services/content-store';
import { normaliseWhatsappNumber } from '../../../app/core/services/whatsapp.service';
import { AdminAlerts } from '../../core/alerts.service';
import { NumbersOnlyDirective } from '../../core/numbers-only.directive';
import { AdminCard } from '../../shared/admin-card';

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
  imports: [ReactiveFormsModule, NgSelectComponent, NumbersOnlyDirective, AdminCard],
  templateUrl: './settings-page.html',
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
    testimonials: this.fb.array<ReturnType<SettingsPage['testimonialGroup']>>([]),
  });

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

  private testimonialGroup(t: Testimonial = { name: '', city: '', tour: '', text: '' }) {
    return this.fb.nonNullable.group({
      name: [t.name],
      city: [t.city],
      tour: [t.tour],
      text: [t.text],
    });
  }

  ngOnInit(): void {
    const s = this.store.settings();
    if (!s) return;
    const { offices, faqs, testimonials, ...plain } = s;
    this.form.patchValue(plain);
    offices.forEach((o) => this.form.controls.offices.push(this.officeGroup(o)));
    faqs.forEach((f) => this.form.controls.faqs.push(this.faqGroup(f)));
    testimonials.forEach((t) => this.form.controls.testimonials.push(this.testimonialGroup(t)));
  }

  addOffice(): void {
    this.form.controls.offices.push(this.officeGroup());
  }

  addFaq(): void {
    this.form.controls.faqs.push(this.faqGroup());
  }

  addTestimonial(): void {
    this.form.controls.testimonials.push(this.testimonialGroup());
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
        'Some fields need attention. Every office needs a name.',
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
      testimonials: v.testimonials.filter((t) => t.name.trim() && t.text.trim()),
    };
    this.store.saveDraft('settings', settings);
    this.form.markAsPristine();
    void this.alerts.success('Settings saved', 'Publish them to make them live.');
  }
}
