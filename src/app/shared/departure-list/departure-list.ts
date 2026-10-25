import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TourPackage } from '../../core/models';
import { CatalogService } from '../../core/services/catalog.service';
import { formatRange, formatWeekday } from '../../core/utils/dates';
import { formatInr } from '../../core/utils/price';
import {
  STATE_LABELS,
  departureState,
  optionPrice,
  seatsLeft,
  startingPrice,
} from '../../core/utils/trip-rules';
import { Icon } from '../icons';

@Component({
  selector: 'app-departure-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  templateUrl: './departure-list.html',
  styleUrl: './departure-list.scss',
})
export class DepartureList {
  private readonly catalog = inject(CatalogService);

  readonly tour = input.required<TourPackage>();

  readonly rows = computed(() => {
    const tour = this.tour();
    return this.catalog.departuresOf(tour.id).map((d) => {
      const state = departureState(d);
      const taken = Object.values(d.seatsTaken).reduce((a, b) => a + b, 0);
      return {
        departure: d,
        state,
        stateLabel: STATE_LABELS[state],
        dates: formatRange(d.startDate, d.endDate),
        weekday: formatWeekday(d.startDate),
        filled: Math.min(100, Math.round((taken / d.totalSeats) * 100)),
        left: seatsLeft(d),
        price: formatInr(startingPrice(tour, d)),
        discounted: Object.keys(d.priceOverrides).length > 0,
        options: tour.travelOptions
          .filter((o) => o.id in d.optionSeats)
          .map((o) => ({
            label: o.label,
            type: o.type,
            left: seatsLeft(d, o.id),
            price: formatInr(optionPrice(d, o)),
          })),
      };
    });
  });
}
