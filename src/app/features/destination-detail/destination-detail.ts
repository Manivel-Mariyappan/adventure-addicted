import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { SeoService } from '../../core/services/seo.service';
import { enquiryMessages } from '../../core/services/whatsapp.service';
import { assetUrl } from '../../core/utils/url';
import { DestinationCard } from '../../shared/destination-card';
import { Icon } from '../../shared/icons';
import { TourCard } from '../../shared/tour-card/tour-card';
import { WhatsappButton } from '../../shared/whatsapp-button';

@Component({
  selector: 'app-destination-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DecimalPipe, Icon, TourCard, DestinationCard, WhatsappButton],
  templateUrl: './destination-detail.html',
  styleUrl: './destination-detail.scss',
})
export class DestinationDetail {
  readonly catalog = inject(CatalogService);
  readonly slug = input.required<string>();

  readonly place = computed(() => this.catalog.destination(this.slug()));
  readonly image = computed(() => assetUrl(this.place()?.image ?? 'art/hero.svg'));
  readonly gallery = computed(() => (this.place()?.gallery ?? []).map(assetUrl));
  readonly parent = computed(() => {
    const p = this.place();
    return p?.parentId ? this.catalog.destinationById(p.parentId) : undefined;
  });
  readonly children = computed(() => {
    const p = this.place();
    return p ? this.catalog.children(p) : [];
  });
  readonly tours = computed(() => {
    const p = this.place();
    return p ? this.catalog.toursFor(p) : [];
  });
  readonly enquiry = computed(() => enquiryMessages.destination(this.place()?.name ?? ''));

  constructor() {
    const seo = inject(SeoService);
    effect(() => {
      const p = this.place();
      if (!p) return;
      seo.set({
        title: p.metaTitle || `${p.name} tours`,
        description: p.metaDescription || `${p.summary} Best time: ${p.bestSeason}.`,
        path: `/destinations/${p.slug}`,
        image: p.image,
      });
    });
  }
}
