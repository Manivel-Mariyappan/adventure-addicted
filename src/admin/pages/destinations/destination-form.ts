import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectComponent } from '@ng-select/ng-select';
import { Destination, Faq } from '../../../app/core/models';
import { ContentStore } from '../../../app/core/services/content-store';
import { assetUrl, slugify } from '../../../app/core/utils/url';
import { AdminAlerts } from '../../core/alerts.service';
import { resizeToWebp } from '../../core/image-resize';
import { fromLines, toLines } from '../../core/lines';
import { newId } from '../../core/local-collection';
import { NumbersOnlyDirective } from '../../core/numbers-only.directive';
import { AdminCard } from '../../shared/admin-card';

@Component({
  selector: 'app-destination-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, NgSelectComponent, NumbersOnlyDirective, AdminCard],
  templateUrl: './destination-form.html',
  host: { class: 'd-flex flex-column h-100' },
})
export class DestinationForm implements OnInit {
  private readonly store = inject(ContentStore);
  private readonly fb = inject(FormBuilder);
  private readonly alerts = inject(AdminAlerts);
  readonly offcanvas = inject(NgbActiveOffcanvas);
  readonly assetUrl = assetUrl;

  // null when adding
  destination: Destination | null = null;

  readonly image = signal('');
  readonly submitted = signal(false);
  readonly regions = computed(() =>
    this.store.destinations().filter((d) => !d.parentId && d.id !== this.destination?.id),
  );

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(60)]],
    slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
    parentId: this.fb.control<string | null>(null),
    region: [''],
    summary: ['', Validators.maxLength(140)],
    description: [''],
    highlights: [''],
    bestSeason: [''],
    altitudeM: this.fb.control<string | number | null>(null),
    gallery: [''],
    featured: [false],
    active: [true],
    displayOrder: this.fb.control<string | number>(1),
    metaTitle: [''],
    metaDescription: [''],
    faqs: this.fb.array<ReturnType<DestinationForm['faqGroup']>>([]),
  });

  private faqGroup(f: Faq = { question: '', answer: '' }) {
    return this.fb.nonNullable.group({ question: [f.question], answer: [f.answer] });
  }

  ngOnInit(): void {
    const d = this.destination;
    if (d) {
      this.form.patchValue({
        ...d,
        highlights: toLines(d.highlights),
        gallery: toLines(d.gallery),
      });
      d.faqs.forEach((f) => this.form.controls.faqs.push(this.faqGroup(f)));
      this.image.set(d.image);
    } else {
      this.form.controls.displayOrder.setValue(this.store.destinations().length + 1);
    }
    this.form.controls.name.valueChanges.subscribe((name) => {
      if (!d && !this.form.controls.slug.dirty) this.form.controls.slug.setValue(slugify(name));
    });
    // a place inherits its region's name
    this.form.controls.parentId.valueChanges.subscribe((id) => {
      const parent = this.store.destinations().find((x) => x.id === id);
      if (parent) this.form.controls.region.setValue(parent.name);
    });
  }

  addFaq(): void {
    this.form.controls.faqs.push(this.faqGroup());
  }

  invalid(name: 'name' | 'slug'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || this.submitted());
  }

  async upload(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (file) this.image.set(await resizeToWebp(file, 1600));
    input.value = '';
  }

  async save(): Promise<void> {
    this.submitted.set(true);
    if (this.form.invalid) {
      void this.alerts.error('Please check the form', 'Name and URL slug are required.');
      return;
    }
    const v = this.form.getRawValue();
    const others = this.store.destinations().filter((d) => d.id !== this.destination?.id);
    if (others.some((d) => d.slug === v.slug)) {
      void this.alerts.error(
        'Duplicate URL slug',
        `The URL slug "${v.slug}" is already used by another destination.`,
      );
      return;
    }
    if (this.destination && !(await this.alerts.confirm('Update this destination?', v.name)))
      return;

    const record: Destination = {
      id: this.destination?.id ?? newId('dst'),
      ...v,
      region: v.parentId ? v.region : v.name,
      highlights: fromLines(v.highlights),
      gallery: fromLines(v.gallery),
      altitudeM: v.altitudeM === null || v.altitudeM === '' ? null : Number(v.altitudeM),
      displayOrder: Number(v.displayOrder) || 0,
      image: this.image(),
      faqs: v.faqs.filter((f) => f.question.trim() && f.answer.trim()),
    };
    this.store.saveDraft(
      'destinations',
      this.destination
        ? this.store.destinations().map((d) => (d.id === record.id ? record : d))
        : [...this.store.destinations(), record],
    );
    this.offcanvas.close(record);
    void this.alerts.success(
      this.destination ? 'Destination updated' : 'Destination added',
      record.name,
    );
  }
}
