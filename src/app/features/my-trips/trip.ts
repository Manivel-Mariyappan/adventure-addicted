import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { ContentStore } from '../../core/services/content-store';
import { MyTripsService } from '../../core/services/my-trips.service';
import { SeoService } from '../../core/services/seo.service';
import { WhatsappService, enquiryMessages } from '../../core/services/whatsapp.service';
import { addDays, formatDate, formatRange, todayIso } from '../../core/utils/dates';
import { formatInr, roundMoney } from '../../core/utils/price';
import { cancellationEstimate } from '../../core/utils/trip-rules';
import { STATUS_TONE } from '../../core/utils/status-tone';
import { Icon } from '../../shared/icons';

@Component({
  selector: 'app-trip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  templateUrl: './trip.html',
  styleUrl: './trip.scss',
})
export class Trip {
  private readonly catalog = inject(CatalogService);
  private readonly myTrips = inject(MyTripsService);
  private readonly whatsapp = inject(WhatsappService);
  private readonly router = inject(Router);
  readonly settings = inject(ContentStore).settings;
  readonly formatInr = formatInr;
  readonly formatDate = formatDate;
  readonly tones = STATUS_TONE;

  readonly ref = input.required<string>();

  readonly trip = computed(() => this.myTrips.trip(this.ref()));
  readonly tour = computed(() => {
    const code = this.trip()?.tourCode;
    return this.catalog.tours().find((t) => t.code === code);
  });
  readonly departure = computed(() => {
    const code = this.trip()?.departureCode;
    return code ? this.catalog.departure(code) : undefined;
  });
  readonly published = computed(() => this.myTrips.status(this.ref()));
  readonly status = computed(
    () => this.published()?.status ?? (this.trip()?.waitlist ? 'Waitlisted' : 'Requested'),
  );
  readonly option = computed(() =>
    this.tour()?.travelOptions.find((o) => o.id === this.trip()?.optionId),
  );
  readonly dates = computed(() => {
    const t = this.trip();
    return t ? formatRange(t.startDate, t.endDate) : '';
  });

  readonly money = computed(() => {
    const t = this.trip();
    const s = this.settings();
    if (!t || !s) return null;
    const total = this.published()?.total ?? t.total;
    const paid = this.published()?.paid ?? 0;
    const balanceDue = addDays(t.startDate, -s.balanceDueDays);
    return {
      total,
      paid,
      due: roundMoney(Math.max(0, total - paid)),
      advanceDue: Math.max(0, t.advance - paid),
      balanceDue: balanceDue < todayIso() ? todayIso() : balanceDue,
    };
  });

  // only travellers with confirmed seats see the coordinator's number
  readonly coordinator = computed(() => {
    const confirmed = this.status() === 'Confirmed' || this.status() === 'Completed';
    return confirmed
      ? this.catalog.coordinator(this.departure()?.coordinatorId ?? null)
      : undefined;
  });

  readonly steps = computed(() => {
    const status = this.status();
    const paid = this.money()?.paid ?? 0;
    const total = this.money()?.total ?? 0;
    return [
      { label: 'Request sent', done: true },
      { label: 'Seats confirmed', done: ['Confirmed', 'Completed'].includes(status) },
      { label: 'Fully paid', done: total > 0 && paid >= total },
      { label: 'Trip completed', done: status === 'Completed' },
    ];
  });

  readonly cancelOpen = signal(false);
  readonly reason = signal('');
  readonly estimate = computed(() => {
    const t = this.trip();
    const policy = this.tour()?.cancellationPolicy;
    return t && policy ? cancellationEstimate(policy, t.startDate, this.money()?.paid ?? 0) : null;
  });
  readonly canCancel = computed(
    () =>
      !['Cancelled', 'Completed', 'Refund pending'].includes(this.status()) &&
      (this.trip()?.startDate ?? '') > todayIso(),
  );

  readonly payHref = computed(() => {
    const m = this.money();
    if (!m || !m.due) return null;
    const amount = m.advanceDue ? m.advanceDue : m.due;
    return this.whatsapp.link(enquiryMessages.payment(this.ref(), formatInr(amount)));
  });
  readonly cancelHref = computed(() =>
    this.whatsapp.link(enquiryMessages.cancel(this.ref(), this.reason().trim())),
  );

  constructor() {
    inject(SeoService).set({
      title: 'My trip',
      description: 'Booking status, payments and travellers.',
    });
  }

  markCancelRequested(): void {
    this.myTrips.markCancelRequested(this.ref());
    this.cancelOpen.set(false);
  }

  forget(): void {
    if (!confirm('Remove this trip from this device? Your booking with us is not affected.'))
      return;
    this.myTrips.remove(this.ref());
    void this.router.navigate(['/my-trips']);
  }
}
