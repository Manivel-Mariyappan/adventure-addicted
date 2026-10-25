import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Coordinator, Difficulty } from '../../core/models';
import { CatalogService } from '../../core/services/catalog.service';
import { ContentStore } from '../../core/services/content-store';
import { SeoService } from '../../core/services/seo.service';
import { enquiryMessages } from '../../core/services/whatsapp.service';
import { formatRange } from '../../core/utils/dates';
import { formatInr } from '../../core/utils/price';
import { departureState, isBookable, seatsLeft } from '../../core/utils/trip-rules';
import { assetUrl } from '../../core/utils/url';
import { DepartureList } from '../../shared/departure-list/departure-list';
import { Icon } from '../../shared/icons';
import { Itinerary } from '../../shared/itinerary/itinerary';
import { WhatsappButton } from '../../shared/whatsapp-button';

const DIFFICULTY_NOTES: Record<Difficulty, string> = {
  Easy: 'Good roads and short days. Fine for families and first-timers.',
  Moderate: 'Some long days and rough patches, with altitude above 3,500 m on a few days.',
  Challenging:
    'High passes above 5,000 m, broken roads and water crossings. You should be fit and comfortable on a bike or behind the wheel in the mountains.',
  Extreme: 'Remote routes with long days at very high altitude. For experienced riders only.',
};

@Component({
  selector: 'app-tour-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DecimalPipe, Icon, Itinerary, DepartureList, WhatsappButton],
  templateUrl: './tour-detail.html',
  styleUrl: './tour-detail.scss',
})
export class TourDetail {
  readonly catalog = inject(CatalogService);
  readonly settings = inject(ContentStore).settings;
  readonly formatInr = formatInr;

  readonly slug = input.required<string>();

  readonly tour = computed(() => this.catalog.tour(this.slug()));
  readonly cover = computed(() => assetUrl(this.tour()?.coverImage ?? 'art/hero.svg'));
  readonly places = computed(() => {
    const t = this.tour();
    return t ? this.catalog.destinationsOf(t) : [];
  });
  readonly difficultyNote = computed(() => DIFFICULTY_NOTES[this.tour()?.difficulty ?? 'Moderate']);
  readonly fromPrice = computed(() => {
    const t = this.tour();
    return t ? formatInr(this.catalog.fromPrice(t)) : '';
  });

  readonly next = computed(() => {
    const t = this.tour();
    const d = t && this.catalog.nextDeparture(t.id);
    if (!d) return null;
    return {
      id: d.id,
      dates: formatRange(d.startDate, d.endDate),
      left: seatsLeft(d),
      bookable: isBookable(departureState(d)),
    };
  });

  // coordinators leading this tour's upcoming departures
  readonly coordinators = computed(() => {
    const t = this.tour();
    if (!t) return [];
    const ids = new Set(this.catalog.departuresOf(t.id).map((d) => d.coordinatorId));
    return [...ids].map((id) => this.catalog.coordinator(id)).filter((c): c is Coordinator => !!c);
  });

  readonly policyRows = computed(() => {
    const rules = [...(this.tour()?.cancellationPolicy ?? [])].sort(
      (a, b) => b.daysBefore - a.daysBefore,
    );
    return rules.map((rule, i) => ({
      when:
        i === 0
          ? `${rule.daysBefore}+ days before departure`
          : `${rule.daysBefore}–${rules[i - 1].daysBefore - 1} days before`,
      refund: rule.refundPercent ? `${rule.refundPercent}% refund` : 'No refund',
    }));
  });

  readonly enquiry = computed(() => enquiryMessages.tour(this.tour()?.name ?? ''));

  constructor() {
    const seo = inject(SeoService);
    effect(() => {
      const t = this.tour();
      if (!t) {
        if (this.catalog.state() !== 'loading') {
          seo.set({ title: 'Tour not found', description: 'This tour is no longer listed.' });
        }
        return;
      }
      const next = this.catalog.nextDeparture(t.id);
      seo.set({
        title: `${t.name} (${t.days}D/${t.nights}N)`,
        description: `${t.summary} From ${formatInr(this.catalog.fromPrice(t))} per person.`,
        path: `/tours/${t.slug}`,
        image: t.coverImage,
        type: 'product',
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'TouristTrip',
          name: t.name,
          description: t.summary,
          touristType: t.travelOptions.map((o) => o.label),
          itinerary: {
            '@type': 'ItemList',
            itemListElement: t.itinerary.map((d) => ({
              '@type': 'ListItem',
              position: d.day,
              name: d.title,
            })),
          },
          offers: next
            ? {
                '@type': 'Offer',
                price: this.catalog.fromPrice(t),
                priceCurrency: 'INR',
                availability:
                  seatsLeft(next) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
                validFrom: next.startDate,
              }
            : undefined,
        },
      });
    });
  }
}
