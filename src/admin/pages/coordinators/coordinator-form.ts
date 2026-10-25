import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { Coordinator } from '../../../app/core/models';
import { ContentStore } from '../../../app/core/services/content-store';
import { AdminAlerts } from '../../core/alerts.service';
import { sha256Hex } from '../../core/hash';
import { newId } from '../../core/local-collection';
import { NumbersOnlyDirective } from '../../core/numbers-only.directive';
import { AdminCard } from '../../shared/admin-card';

@Component({
  selector: 'app-coordinator-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, NumbersOnlyDirective, AdminCard],
  host: { class: 'd-flex flex-column h-100' },
  template: `
    <div class="offcanvas-header border-bottom bg-white">
      <h2 class="offcanvas-title h5 mb-0" id="coordinator-form-title">
        {{ coordinator ? 'Edit coordinator' : 'Add coordinator' }}
      </h2>
      <button
        type="button"
        class="btn-close"
        aria-label="Close"
        (click)="offcanvas.dismiss()"
      ></button>
    </div>

    <form
      class="offcanvas-body bg-body-tertiary"
      [formGroup]="form"
      (ngSubmit)="save()"
      id="coordinator-form"
      novalidate
    >
      <admin-card heading="Profile" subtitle="Shown on tour pages" icon="☺" [required]="true">
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label" for="c-name"
              >Full name <span class="text-danger">*</span></label
            >
            <input
              id="c-name"
              class="form-control"
              formControlName="name"
              placeholder="Enter full name"
              [class.is-invalid]="invalid('name')"
            />
          </div>
          <div class="col-md-6">
            <label class="form-label" for="c-phone">Phone <span class="text-danger">*</span></label>
            <input
              id="c-phone"
              class="form-control"
              formControlName="phone"
              placeholder="+91 90000 00000"
              [class.is-invalid]="invalid('phone')"
            />
            <div class="form-text">Shown only to travellers with confirmed seats.</div>
          </div>
          <div class="col-md-8">
            <label class="form-label" for="c-lang">Languages</label>
            <input
              id="c-lang"
              class="form-control"
              formControlName="languages"
              placeholder="Comma separated, e.g. English, Hindi"
            />
          </div>
          <div class="col-md-4">
            <label class="form-label" for="c-exp">Experience</label>
            <div class="input-group">
              <input
                id="c-exp"
                class="form-control"
                formControlName="experienceYears"
                appNumbersOnly
                [decimals]="0"
                placeholder="5"
              />
              <span class="input-group-text">years</span>
            </div>
          </div>
          <div class="col-12">
            <label class="form-label" for="c-bio">Short bio</label>
            <textarea
              id="c-bio"
              class="form-control"
              rows="3"
              formControlName="bio"
              placeholder="Where they are from and the trips they lead"
            ></textarea>
          </div>
        </div>
      </admin-card>

      <admin-card
        heading="Coordinator portal"
        subtitle="They sign in at /coordinator with this PIN"
        icon="⚿"
      >
        <label class="form-label" for="c-pin">{{ coordinator ? 'New PIN' : 'PIN' }}</label>
        <input
          id="c-pin"
          class="form-control"
          formControlName="pin"
          appNumbersOnly
          [decimals]="0"
          maxlength="6"
          inputmode="numeric"
          [placeholder]="coordinator ? 'Leave empty to keep the current PIN' : '4 to 6 digits'"
          [class.is-invalid]="pinError()"
        />
        @if (pinError()) {
          <div class="invalid-feedback">Enter a PIN of 4 to 6 digits.</div>
        }
        <div class="form-check form-switch mt-3">
          <input
            class="form-check-input"
            type="checkbox"
            role="switch"
            id="c-active"
            formControlName="active"
          />
          <label class="form-check-label" for="c-active">Active</label>
        </div>
      </admin-card>
    </form>

    <div class="border-top bg-white p-3 d-flex justify-content-end gap-2">
      <button type="button" class="btn btn-outline-secondary" (click)="offcanvas.dismiss()">
        Cancel
      </button>
      <button type="submit" form="coordinator-form" class="btn btn-primary px-4">
        {{ coordinator ? 'Update coordinator' : 'Add coordinator' }}
      </button>
    </div>
  `,
})
export class CoordinatorForm implements OnInit {
  private readonly store = inject(ContentStore);
  private readonly fb = inject(FormBuilder);
  private readonly alerts = inject(AdminAlerts);
  readonly offcanvas = inject(NgbActiveOffcanvas);

  // null when adding
  coordinator: Coordinator | null = null;

  readonly submitted = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    phone: ['', Validators.required],
    languages: [''],
    experienceYears: this.fb.control<string | number>(''),
    bio: [''],
    pin: [''],
    active: [true],
  });

  ngOnInit(): void {
    const c = this.coordinator;
    if (c) this.form.patchValue({ ...c, languages: c.languages.join(', '), pin: '' });
  }

  invalid(name: 'name' | 'phone'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || this.submitted());
  }

  pinError(): boolean {
    const pin = String(this.form.controls.pin.value);
    const required = !this.coordinator;
    return this.submitted() && ((required && !pin) || (!!pin && !/^\d{4,6}$/.test(pin)));
  }

  async save(): Promise<void> {
    this.submitted.set(true);
    if (this.form.invalid || this.pinError()) {
      void this.alerts.error('Please check the form', 'Name, phone and a PIN are required.');
      return;
    }
    const v = this.form.getRawValue();
    const pin = String(v.pin);
    const record: Coordinator = {
      id: this.coordinator?.id ?? newId('crd'),
      name: v.name.trim(),
      phone: v.phone.trim(),
      photo: this.coordinator?.photo ?? '',
      bio: v.bio.trim(),
      languages: v.languages
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean),
      experienceYears: Number(v.experienceYears) || 0,
      pinHash: pin ? await sha256Hex(pin) : (this.coordinator?.pinHash ?? ''),
      active: v.active,
    };
    this.store.saveDraft(
      'coordinators',
      this.coordinator
        ? this.store.coordinators().map((c) => (c.id === record.id ? record : c))
        : [...this.store.coordinators(), record],
    );
    this.offcanvas.close(record);
    void this.alerts.success(
      this.coordinator ? 'Coordinator updated' : 'Coordinator added',
      record.name,
    );
  }
}
