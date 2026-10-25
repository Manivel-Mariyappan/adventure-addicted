import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgSelectComponent } from '@ng-select/ng-select';
import {
  AddOn,
  Difficulty,
  Faq,
  ItineraryDay,
  PolicyRule,
  TourPackage,
  TourStatus,
  TravelOption,
  TravelType,
} from '../../../app/core/models';
import { ContentStore } from '../../../app/core/services/content-store';
import { assetUrl, slugify } from '../../../app/core/utils/url';
import { AdminAlerts } from '../../core/alerts.service';
import { resizeToWebp } from '../../core/image-resize';
import { fromLines, toLines } from '../../core/lines';
import { newId } from '../../core/local-collection';
import { NumbersOnlyDirective } from '../../core/numbers-only.directive';
import { AdminCard } from '../../shared/admin-card';

const num = (v: string | number | null | undefined): number | null =>
  v === null || v === undefined || v === '' ? null : Number(v);

@Component({
  selector: 'app-tour-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, NgSelectComponent, NumbersOnlyDirective, AdminCard],
  templateUrl: './tour-editor.html',
})
export class TourEditor implements OnInit {
  private readonly store = inject(ContentStore);
  private readonly fb = inject(FormBuilder);
  private readonly alerts = inject(AdminAlerts);
  private readonly router = inject(Router);
  readonly assetUrl = assetUrl;

  // 'new' or a tour id
  readonly id = input.required<string>();

  readonly tour = computed(() => this.store.tours().find((t) => t.id === this.id()) ?? null);
  readonly destinations = computed(() =>
    this.store.destinations().map((d) => ({
      id: d.id,
      name: d.name,
      group: d.parentId
        ? (this.store.destinations().find((p) => p.id === d.parentId)?.name ?? '')
        : d.name,
    })),
  );
  readonly difficulties: Difficulty[] = ['Easy', 'Moderate', 'Challenging', 'Extreme'];
  readonly statuses: { value: TourStatus; label: string }[] = [
    { value: 'draft', label: 'Draft (hidden)' },
    { value: 'published', label: 'Published' },
    { value: 'archived', label: 'Archived (hidden)' },
  ];
  readonly travelTypes: { value: TravelType; label: string }[] = [
    { value: 'bike', label: 'Our bike' },
    { value: 'own-car', label: 'Own car' },
    { value: 'vehicle', label: 'Seat in our vehicle' },
  ];

  readonly cover = signal('');
  readonly submitted = signal(false);
  readonly openDay = signal<number | null>(0);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    code: ['', [Validators.required, Validators.pattern(/^[A-Z0-9]{2,8}$/)]],
    slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
    tagline: [''],
    destinationIds: this.fb.nonNullable.control<string[]>([]),
    route: [''],
    summary: [''],
    description: [''],
    highlights: [''],
    gallery: [''],
    days: this.fb.control<string | number>(5, Validators.required),
    nights: this.fb.control<string | number>(4),
    startLocation: [''],
    endLocation: [''],
    difficulty: this.fb.nonNullable.control<Difficulty>('Moderate'),
    maxAltitudeM: this.fb.control<string | number | null>(null),
    totalDistanceKm: this.fb.control<string | number | null>(null),
    flightsIncluded: [false],
    accommodation: [''],
    mealPlan: [''],
    minParticipants: this.fb.control<string | number>(6),
    maxParticipants: this.fb.control<string | number>(16),
    featured: [false],
    status: this.fb.nonNullable.control<TourStatus>('draft'),
    inclusions: [''],
    exclusions: [''],
    documents: [''],
    safety: [''],
    travelOptions: this.fb.array<ReturnType<TourEditor['optionGroup']>>([]),
    addOns: this.fb.array<ReturnType<TourEditor['addOnGroup']>>([]),
    itinerary: this.fb.array<ReturnType<TourEditor['dayGroup']>>([]),
    policy: this.fb.array<ReturnType<TourEditor['policyGroup']>>([]),
    faqs: this.fb.array<ReturnType<TourEditor['faqGroup']>>([]),
  });

  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  readonly dayMismatch = computed(() => {
    const days = Number(this.value().days) || 0;
    const itinerary = this.value().itinerary?.length ?? 0;
    return days !== itinerary ? { days, itinerary } : null;
  });

  private optionGroup(o?: TravelOption) {
    return this.fb.nonNullable.group({
      // ids are stored on departures (seats per option), so they never change once saved
      id: [o?.id ?? ''],
      type: this.fb.nonNullable.control<TravelType>(o?.type ?? 'bike'),
      label: [o?.label ?? '', Validators.required],
      description: [o?.description ?? ''],
      price: this.fb.control<string | number>(o?.price ?? '', Validators.required),
      includes: [toLines(o?.includes ?? [])],
      customerPays: [toLines(o?.customerPays ?? [])],
    });
  }

  private addOnGroup(a?: AddOn) {
    return this.fb.nonNullable.group({
      id: [a?.id ?? ''],
      label: [a?.label ?? '', Validators.required],
      price: this.fb.control<string | number>(a?.price ?? '', Validators.required),
      unit: this.fb.nonNullable.control<AddOn['unit']>(a?.unit ?? 'person'),
    });
  }

  private dayGroup(d?: Partial<ItineraryDay>) {
    return this.fb.nonNullable.group({
      title: [d?.title ?? '', Validators.required],
      location: [d?.location ?? ''],
      description: [d?.description ?? ''],
      activities: [toLines(d?.activities ?? [])],
      stay: [d?.stay ?? ''],
      meals: [d?.meals ?? ''],
      distanceKm: this.fb.control<string | number | null>(d?.distanceKm ?? null),
      altitudeM: this.fb.control<string | number | null>(d?.altitudeM ?? null),
    });
  }

  private policyGroup(p?: PolicyRule) {
    return this.fb.nonNullable.group({
      daysBefore: this.fb.control<string | number>(p?.daysBefore ?? ''),
      refundPercent: this.fb.control<string | number>(p?.refundPercent ?? ''),
    });
  }

  private faqGroup(f?: Faq) {
    return this.fb.nonNullable.group({ question: [f?.question ?? ''], answer: [f?.answer ?? ''] });
  }

  get itinerary() {
    return this.form.controls.itinerary;
  }

  ngOnInit(): void {
    const t = this.tour();
    if (t) {
      const { travelOptions, addOns, itinerary, cancellationPolicy, faqs, ...plain } = t;
      this.form.patchValue({
        ...plain,
        route: t.route.join(', '),
        highlights: toLines(t.highlights),
        gallery: toLines(t.gallery),
        inclusions: toLines(t.inclusions),
        exclusions: toLines(t.exclusions),
        documents: toLines(t.documents),
        safety: toLines(t.safety),
      });
      travelOptions.forEach((o) => this.form.controls.travelOptions.push(this.optionGroup(o)));
      addOns.forEach((a) => this.form.controls.addOns.push(this.addOnGroup(a)));
      itinerary.forEach((d) => this.itinerary.push(this.dayGroup(d)));
      cancellationPolicy.forEach((p) => this.form.controls.policy.push(this.policyGroup(p)));
      faqs.forEach((f) => this.form.controls.faqs.push(this.faqGroup(f)));
      this.cover.set(t.coverImage);
      this.form.controls.code.disable();
    } else {
      this.form.controls.travelOptions.push(this.optionGroup());
      this.itinerary.push(this.dayGroup({ title: 'Arrival' }));
      [
        { daysBefore: 45, refundPercent: 90 },
        { daysBefore: 30, refundPercent: 75 },
        { daysBefore: 15, refundPercent: 50 },
        { daysBefore: 0, refundPercent: 0 },
      ].forEach((p) => this.form.controls.policy.push(this.policyGroup(p)));
      this.form.controls.name.valueChanges.subscribe((name) => {
        if (!this.form.controls.slug.dirty) this.form.controls.slug.setValue(slugify(name));
      });
    }
    // nights follow the days unless edited by hand
    this.form.controls.days.valueChanges.subscribe((days) => {
      if (!this.form.controls.nights.dirty)
        this.form.controls.nights.setValue(Math.max(0, Number(days) - 1));
    });
  }

  addOption(): void {
    this.form.controls.travelOptions.push(this.optionGroup());
  }

  addAddOn(): void {
    this.form.controls.addOns.push(this.addOnGroup());
  }

  addFaq(): void {
    this.form.controls.faqs.push(this.faqGroup());
  }

  addPolicyRule(): void {
    this.form.controls.policy.push(this.policyGroup());
  }

  addDay(): void {
    this.itinerary.push(this.dayGroup());
    this.openDay.set(this.itinerary.length - 1);
  }

  duplicateDay(i: number): void {
    this.itinerary.insert(i + 1, this.dayGroup(this.toDay(i)));
    this.openDay.set(i + 1);
  }

  moveDay(i: number, step: -1 | 1): void {
    const j = i + step;
    if (j < 0 || j >= this.itinerary.length) return;
    const control = this.itinerary.at(i);
    this.itinerary.removeAt(i);
    this.itinerary.insert(j, control);
    this.openDay.set(j);
  }

  async removeDay(i: number): Promise<void> {
    const title = this.itinerary.at(i).controls.title.value || `Day ${i + 1}`;
    if (!(await this.alerts.confirmDelete(`Remove day ${i + 1}?`, title))) return;
    this.itinerary.removeAt(i);
  }

  removeAt(array: FormArray, i: number): void {
    array.removeAt(i);
  }

  async upload(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (file) this.cover.set(await resizeToWebp(file, 1600));
    input.value = '';
  }

  private toDay(i: number): ItineraryDay {
    const d = this.itinerary.at(i).getRawValue();
    return {
      day: i + 1,
      title: d.title.trim(),
      location: d.location.trim(),
      description: d.description.trim(),
      activities: fromLines(d.activities),
      stay: d.stay.trim(),
      meals: d.meals.trim(),
      distanceKm: num(d.distanceKm),
      altitudeM: num(d.altitudeM),
    };
  }

  async save(): Promise<void> {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    const problems: string[] = [];
    if (this.form.controls.name.invalid) problems.push('a name');
    if (this.form.controls.code.invalid)
      problems.push('a code of 2 to 8 capital letters or digits');
    if (this.form.controls.slug.invalid) problems.push('a URL slug');
    if (!v.travelOptions.length || this.form.controls.travelOptions.invalid)
      problems.push('at least one travel option with a label and price');
    if (this.form.controls.addOns.invalid) problems.push('a label and price for every add-on');
    if (!v.itinerary.length || this.itinerary.invalid)
      problems.push('a title for every itinerary day');
    if (problems.length) {
      void this.alerts.error('Please add', problems.join(', ') + '.');
      return;
    }
    const others = this.store.tours().filter((t) => t.id !== this.tour()?.id);
    if (others.some((t) => t.slug === v.slug)) {
      void this.alerts.error('Duplicate URL slug', `"${v.slug}" is already used by another tour.`);
      return;
    }
    if (!this.tour() && others.some((t) => t.code === v.code)) {
      void this.alerts.error(
        'Duplicate code',
        `${v.code} is already used. Codes appear in booking references.`,
      );
      return;
    }
    if (this.dayMismatch()) {
      const m = this.dayMismatch()!;
      const ok = await this.alerts.confirm(
        'Days and itinerary differ',
        `The tour is ${m.days} days but the itinerary has ${m.itinerary}. Save anyway?`,
        'Save anyway',
        'warning',
      );
      if (!ok) return;
    }

    const now = new Date().toISOString();
    const usedIds = new Set([...v.travelOptions, ...v.addOns].map((x) => x.id).filter(Boolean));
    const uniqueId = (wanted: string) => {
      let id = slugify(wanted) || 'option';
      for (let n = 2; usedIds.has(id); n++) id = `${slugify(wanted)}-${n}`;
      usedIds.add(id);
      return id;
    };

    const record: TourPackage = {
      id: this.tour()?.id ?? newId('tour'),
      code: v.code,
      slug: v.slug,
      name: v.name.trim(),
      tagline: v.tagline.trim(),
      destinationIds: v.destinationIds,
      route: v.route
        .split(/,|→/)
        .map((s) => s.trim())
        .filter(Boolean),
      summary: v.summary.trim(),
      description: v.description.trim(),
      highlights: fromLines(v.highlights),
      coverImage: this.cover(),
      gallery: fromLines(v.gallery),
      days: Number(v.days) || 1,
      nights: Number(v.nights) || 0,
      startLocation: v.startLocation.trim(),
      endLocation: v.endLocation.trim(),
      difficulty: v.difficulty,
      maxAltitudeM: num(v.maxAltitudeM),
      totalDistanceKm: num(v.totalDistanceKm),
      flightsIncluded: v.flightsIncluded,
      accommodation: v.accommodation.trim(),
      mealPlan: v.mealPlan.trim(),
      travelOptions: v.travelOptions.map((o) => ({
        id: o.id || uniqueId(`${o.type}-${o.label}`),
        type: o.type,
        label: o.label.trim(),
        description: o.description.trim(),
        price: Number(o.price) || 0,
        includes: fromLines(o.includes),
        customerPays: o.type === 'own-car' ? fromLines(o.customerPays) : [],
      })),
      addOns: v.addOns.map((a) => ({
        id: a.id || uniqueId(a.label),
        label: a.label.trim(),
        price: Number(a.price) || 0,
        unit: a.unit,
      })),
      itinerary: v.itinerary.map((_, i) => this.toDay(i)),
      inclusions: fromLines(v.inclusions),
      exclusions: fromLines(v.exclusions),
      documents: fromLines(v.documents),
      safety: fromLines(v.safety),
      cancellationPolicy: v.policy
        .filter((p) => p.daysBefore !== '' && p.refundPercent !== '')
        .map((p) => ({
          daysBefore: Number(p.daysBefore),
          refundPercent: Math.min(100, Number(p.refundPercent)),
        }))
        .sort((a, b) => b.daysBefore - a.daysBefore),
      faqs: v.faqs.filter((f) => f.question.trim() && f.answer.trim()),
      minParticipants: Number(v.minParticipants) || 1,
      maxParticipants: Number(v.maxParticipants) || 1,
      status: v.status,
      featured: v.featured,
      createdAt: this.tour()?.createdAt ?? now,
      updatedAt: now,
    };
    this.store.saveDraft(
      'tours',
      this.tour()
        ? this.store.tours().map((t) => (t.id === record.id ? record : t))
        : [...this.store.tours(), record],
    );
    this.form.markAsPristine();
    void this.alerts.success(this.tour() ? 'Tour saved' : 'Tour created', record.name);
    if (this.id() === 'new')
      void this.router.navigate(['/admin/tours', record.id], { replaceUrl: true });
  }
}
