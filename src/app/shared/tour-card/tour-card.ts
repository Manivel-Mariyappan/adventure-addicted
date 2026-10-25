import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TourPackage } from '../../core/models';
import { CatalogService } from '../../core/services/catalog.service';
import { formatRange } from '../../core/utils/dates';
import { formatInr } from '../../core/utils/price';
import { STATE_LABELS, departureState, seatsLeft } from '../../core/utils/trip-rules';
import { assetUrl } from '../../core/utils/url';
import { Icon } from '../icons';

@Component({
  selector: 'app-tour-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  templateUrl: './tour-card.html',
  styleUrl: './tour-card.scss',
})
export class TourCard {
  private readonly catalog = inject(CatalogService);

  readonly tour = input.required<TourPackage>();

  readonly image = computed(() => assetUrl(this.tour().coverImage));
  readonly price = computed(() => formatInr(this.catalog.fromPrice(this.tour())));
  readonly types = computed(() => new Set(this.tour().travelOptions.map((o) => o.type)));
  readonly places = computed(() =>
    this.catalog
      .destinationsOf(this.tour())
      .map((d) => d.name)
      .join(' · '),
  );

  readonly next = computed(() => {
    const d = this.catalog.nextDeparture(this.tour().id);
    if (!d) return null;
    const state = departureState(d);
    return {
      dates: formatRange(d.startDate, d.endDate),
      state,
      label:
        state === 'open' || state === 'filling'
          ? `${seatsLeft(d)} seats left`
          : STATE_LABELS[state],
      more: this.catalog.departuresOf(this.tour().id).length - 1,
    };
  });
}
