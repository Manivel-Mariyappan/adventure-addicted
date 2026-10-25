import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgbOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-community';
import { BookingStatus } from '../../../app/core/models';
import { ContentStore } from '../../../app/core/services/content-store';
import { formatInr } from '../../../app/core/utils/price';
import { AdminDataService } from '../../core/admin-data.service';
import { Booking } from '../../core/admin-models';
import { AdminAlerts } from '../../core/alerts.service';
import { downloadCsv } from '../../core/csv';
import { dueOf, holdsSeats, paidOf } from '../../core/ledger';
import {
  adminGridTheme,
  badge,
  formatDate,
  formatDateTime,
  pinRightOnWideScreens,
  rowButtons,
} from '../../shared/grid';
import { BOOKING_STATUSES, BookingForm } from './booking-form';

export const STATUS_COLORS: Record<BookingStatus, string> = {
  Requested: 'primary',
  'Pending payment': 'warning',
  Confirmed: 'success',
  Waitlisted: 'info',
  Cancelled: 'secondary',
  'Refund pending': 'danger',
  Completed: 'dark',
};

interface Row {
  booking: Booking;
  tour: string;
  departure: string;
  start: string;
  paid: number;
  due: number;
  hold: string;
}

@Component({
  selector: 'app-bookings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgGridAngular, RouterLink],
  templateUrl: './bookings-page.html',
})
export class BookingsPage {
  readonly data = inject(AdminDataService);
  private readonly store = inject(ContentStore);
  private readonly offcanvas = inject(NgbOffcanvas);
  private readonly alerts = inject(AdminAlerts);

  // ?departure= from the departure page
  readonly departure = input<string>();

  readonly theme = adminGridTheme;
  readonly statuses = BOOKING_STATUSES;
  readonly search = signal('');
  readonly status = signal<BookingStatus | null>(null);
  readonly getRowId = (p: { data: Row }) => p.data.booking.id;

  readonly departureFilter = computed(() =>
    this.store.departures().find((d) => d.id === this.departure()),
  );

  private readonly all = computed<Row[]>(() => {
    const tours = new Map(this.store.tours().map((t) => [t.id, t.name]));
    const departures = new Map(this.store.departures().map((d) => [d.id, d]));
    const now = new Date().toISOString();
    return this.data.bookings.all().map((b) => {
      const d = departures.get(b.departureId);
      const unpaid = b.status === 'Requested' || b.status === 'Pending payment';
      return {
        booking: b,
        tour: tours.get(b.tourId) ?? '',
        departure: d?.code ?? '',
        start: d?.startDate ?? '',
        paid: paidOf(b),
        due: dueOf(b),
        hold: unpaid
          ? holdsSeats(b, now)
            ? `until ${formatDateTime(b.holdUntil)}`
            : 'expired'
          : '',
      };
    });
  });

  readonly rows = computed(() =>
    this.all().filter(
      (r) =>
        (!this.status() || r.booking.status === this.status()) &&
        (!this.departure() || r.booking.departureId === this.departure()),
    ),
  );

  readonly counts = computed(() => {
    const c = Object.fromEntries(this.statuses.map((s) => [s, 0])) as Record<BookingStatus, number>;
    for (const r of this.all()) {
      if (!this.departure() || r.booking.departureId === this.departure()) c[r.booking.status]++;
    }
    return c;
  });

  readonly columns: ColDef<Row>[] = [
    { headerName: 'Ref', valueGetter: (p) => p.data?.booking.ref, width: 130, pinned: 'left' },
    {
      headerName: 'Booked',
      valueGetter: (p) => p.data?.booking.createdAt,
      valueFormatter: (p) => formatDate(p.value as string),
      width: 125,
      sort: 'desc',
    },
    {
      headerName: 'Lead traveller',
      valueGetter: (p) => p.data?.booking.lead.name,
      flex: 1,
      minWidth: 160,
    },
    { headerName: 'Phone', valueGetter: (p) => p.data?.booking.lead.phone, width: 125 },
    { headerName: 'Tour', field: 'tour', flex: 1, minWidth: 180 },
    { headerName: 'Departure', field: 'departure', width: 140 },
    { headerName: 'Pax', valueGetter: (p) => p.data?.booking.travellers, width: 75 },
    {
      headerName: 'Total',
      valueGetter: (p) => p.data?.booking.total,
      valueFormatter: (p) => formatInr(p.value as number),
      width: 115,
      type: 'rightAligned',
    },
    {
      headerName: 'Paid',
      field: 'paid',
      valueFormatter: (p) => formatInr(p.value as number),
      width: 115,
      type: 'rightAligned',
    },
    {
      headerName: 'Due',
      field: 'due',
      valueFormatter: (p) => (p.value ? formatInr(p.value as number) : '—'),
      width: 110,
      type: 'rightAligned',
    },
    {
      headerName: 'Status',
      valueGetter: (p) => p.data?.booking.status,
      width: 140,
      cellRenderer: badge(STATUS_COLORS),
    },
    {
      headerName: 'Seat hold',
      field: 'hold',
      width: 160,
      cellClassRules: { 'text-danger': (p) => p.value === 'expired' },
    },
    { headerName: 'Source', valueGetter: (p) => p.data?.booking.source, width: 115 },
    {
      headerName: 'Actions',
      colId: 'actions',
      width: 110,
      sortable: false,
      filter: false,
      pinned: pinRightOnWideScreens(),
      cellRenderer: rowButtons<Row>((r) => [
        { label: 'Open', className: 'btn-outline-primary', onClick: () => this.open(r.booking) },
      ]),
    },
  ];

  open(booking: Booking | null): void {
    const ref = this.offcanvas.open(BookingForm, {
      position: 'end',
      panelClass: 'aac-offcanvas-xl',
      backdrop: 'static',
      ariaLabelledBy: 'booking-form-title',
    });
    const form = ref.componentInstance as BookingForm;
    form.booking = booking;
    form.presetDepartureId = this.departure() ?? null;
  }

  exportCsv(): void {
    downloadCsv(
      'bookings.csv',
      this.rows().map((r) => ({
        Ref: r.booking.ref,
        Booked: r.booking.createdAt.slice(0, 10),
        Status: r.booking.status,
        'Lead traveller': r.booking.lead.name,
        Phone: r.booking.lead.phone,
        Email: r.booking.lead.email,
        Tour: r.tour,
        Departure: r.departure,
        Travellers: r.booking.travellers,
        Total: r.booking.total,
        Paid: r.paid,
        Due: r.due,
        Source: r.booking.source,
      })),
    );
  }

  async deleteDemo(): Promise<void> {
    const n = this.data.demoBookingCount();
    const ok = await this.alerts.confirmDelete(
      `Delete ${n} demo bookings?`,
      'Seat counts drop to your real bookings. Publish departures.json afterwards.',
    );
    if (!ok) return;
    this.data.bookings.setAll(this.data.bookings.all().filter((b) => !b.demo));
    void this.alerts.toast('Demo bookings deleted');
  }
}
