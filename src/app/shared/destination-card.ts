import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Destination } from '../core/models';
import { CatalogService } from '../core/services/catalog.service';
import { assetUrl } from '../core/utils/url';

@Component({
  selector: 'app-destination-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <a [routerLink]="['/destinations', destination().slug]">
      <img [src]="image()" alt="" loading="lazy" decoding="async" width="1600" height="1000" />
      <span class="text">
        <span class="name">{{ destination().name }}</span>
        <span class="summary">{{ destination().summary }}</span>
        <span class="count">
          {{ tourCount() }} {{ tourCount() === 1 ? 'tour' : 'tours' }} · Best
          {{ destination().bestSeason }}
        </span>
      </span>
    </a>
  `,
  styles: `
    a {
      position: relative;
      display: block;
      aspect-ratio: 4 / 5;
      overflow: hidden;
      color: #fff;
      text-decoration: none;
      border-radius: var(--radius);
      isolation: isolate;
    }
    :host(.wide) a {
      aspect-ratio: 16 / 10;
    }
    img {
      position: absolute;
      inset: 0;
      z-index: -2;
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.6s var(--ease);
    }
    a::after {
      content: '';
      position: absolute;
      inset: 0;
      z-index: -1;
      background: linear-gradient(180deg, transparent 35%, rgba(15, 31, 61, 0.88));
    }
    a:hover img {
      transform: scale(1.05);
    }
    .text {
      position: absolute;
      inset: auto 0 0;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 1.1rem 1.15rem;
    }
    .name {
      font-family: var(--font-head);
      font-size: 1.4rem;
      font-weight: 700;
    }
    .summary {
      font-size: 0.85rem;
      color: #e2e8f0;
    }
    .count {
      margin-top: 0.3rem;
      font-size: 0.74rem;
      font-weight: 600;
      color: #fdba74;
    }
  `,
})
export class DestinationCard {
  private readonly catalog = inject(CatalogService);
  readonly destination = input.required<Destination>();

  readonly image = computed(() => assetUrl(this.destination().image));
  readonly tourCount = computed(() => this.catalog.toursFor(this.destination()).length);
}
