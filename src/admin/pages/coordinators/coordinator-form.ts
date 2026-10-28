import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { Coordinator } from '../../../app/core/models';
import { ContentStore } from '../../../app/core/services/content-store';
import { assetUrl } from '../../../app/core/utils/url';
import { AdminAlerts } from '../../core/alerts.service';
import { sha256Hex } from '../../core/hash';
import { resizeToWebp } from '../../core/image-resize';
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
        <div class="d-flex align-items-center gap-3 mb-3">
          @if (photo()) {
            <img
              [src]="assetUrl(photo())"
              alt="Profile image"
              width="72"
              height="72"
              class="rounded-circle border flex-shrink-0"
              style="object-fit: cover"
            />
          } @else {
            <span
              class="rounded-circle bg-body-secondary text-body-secondary d-grid flex-shrink-0 fs-3 fw-bold"
              style="width: 72px; height: 72px; place-items: center"
              aria-hidden="true"
            >
              {{ form.controls.name.value.trim().charAt(0) || '?' }}
            </span>
          }
          <div>
            <div class="fw-semibold mb-1">Profile image</div>
            <div class="d-flex gap-2">
              <label class="btn btn-sm btn-outline-primary mb-0">
                {{ photo() ? 'Change image' : 'Upload image' }}
                <input
                  #file
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  (change)="upload(file)"
                />
              </label>
              @if (photo()) {
                <button type="button" class="btn btn-sm btn-outline-danger" (click)="photo.set('')">
                  Remove
                </button>
              }
            </div>
            <div class="form-text">Square photo works best. JPG, PNG or WebP.</div>
          </div>
        </div>
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
            <div class="invalid-feedback">Full name is required.</div>
          </div>
          <div class="col-md-6">
            <label class="form-label" for="c-email">Email <span class="text-danger">*</span></label>
            <input
              id="c-email"
              type="email"
              class="form-control"
              formControlName="email"
              placeholder="Enter email address"
              autocomplete="off"
              [class.is-invalid]="invalid('email')"
            />
            <div class="invalid-feedback">
              {{
                form.controls.email.hasError('required')
                  ? 'Email is required.'
                  : 'Enter a valid email address.'
              }}
            </div>
          </div>
          <div class="col-md-6">
            <label class="form-label" for="c-phone">Phone <span class="text-danger">*</span></label>
            <input
              id="c-phone"
              class="form-control"
              formControlName="phone"
              placeholder="Enter 10-digit mobile number"
              maxlength="10"
              appNumbersOnly
              [decimals]="0"
              inputmode="numeric"
              [class.is-invalid]="invalid('phone')"
            />
            <div class="invalid-feedback">
              {{
                form.controls.phone.hasError('required')
                  ? 'Phone is required.'
                  : 'Enter a valid 10-digit mobile number.'
              }}
            </div>
            <div class="form-text">Shown only to travellers with confirmed seats.</div>
          </div>
          <div class="col-md-6">
            <label class="form-label" for="c-exp"
              >Experience (in years) <span class="text-danger">*</span></label
            >
            <input
              id="c-exp"
              class="form-control"
              formControlName="experienceYears"
              appNumbersOnly
              [decimals]="0"
              maxlength="2"
              inputmode="numeric"
              placeholder="e.g. 5"
              [class.is-invalid]="invalid('experienceYears')"
            />
            <div class="invalid-feedback">
              {{
                form.controls.experienceYears.hasError('required')
                  ? 'Experience is required.'
                  : 'Enter a number from 1 to 99.'
              }}
            </div>
          </div>
          <div class="col-12">
            <label class="form-label" for="c-lang">Languages</label>
            <input
              id="c-lang"
              class="form-control"
              formControlName="languages"
              placeholder="Comma separated, e.g. English, Hindi"
            />
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
          <div class="invalid-feedback">PIN must be 4 to 6 digits.</div>
        }
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
  // data URL from an upload, or a path from coordinators.json
  readonly photo = signal('');
  readonly assetUrl = assetUrl;

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    languages: [''],
    // 1 to 99; 0 and 00 are not allowed
    experienceYears: this.fb.control<string | number>('', [
      Validators.required,
      Validators.pattern(/^[1-9]\d?$/),
    ]),
    bio: [''],
    pin: [''],
  });

  ngOnInit(): void {
    const c = this.coordinator;
    if (!c) return;
    this.form.patchValue({
      ...c,
      email: c.email ?? '',
      // older records have "+91 90000 00011"; keep the last 10 digits
      phone: c.phone.replace(/\D/g, '').slice(-10),
      experienceYears: c.experienceYears || '',
      languages: c.languages.join(', '),
      pin: '',
    });
    this.photo.set(c.photo);
  }

  async upload(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    // a small square is plenty for a round avatar, and keeps coordinators.json light
    if (file) this.photo.set(await resizeToWebp(file, 400));
    input.value = '';
  }

  invalid(name: 'name' | 'email' | 'phone' | 'experienceYears'): boolean {
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
      void this.alerts.error(
        'Please check the form',
        'Full name, a valid email, a 10-digit phone, experience (1 to 99 years) and PIN are required.',
      );
      return;
    }
    const v = this.form.getRawValue();
    const pin = String(v.pin);
    const record: Coordinator = {
      id: this.coordinator?.id ?? newId('crd'),
      name: v.name.trim(),
      email: v.email.trim(),
      phone: v.phone.trim(),
      photo: this.photo(),
      bio: v.bio.trim(),
      languages: v.languages
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean),
      experienceYears: Number(v.experienceYears) || 0,
      pinHash: pin ? await sha256Hex(pin) : (this.coordinator?.pinHash ?? ''),
      // deleting and activating happen from the list, not here
      active: this.coordinator?.active ?? true,
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
