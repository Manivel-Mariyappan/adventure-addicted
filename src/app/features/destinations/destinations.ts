import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { SeoService } from '../../core/services/seo.service';
import { DestinationCard } from '../../shared/destination-card';

@Component({
  selector: 'app-destinations',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DestinationCard],
  template: `
    <section class="banner">
      <div class="container">
        <nav class="crumbs" aria-label="Breadcrumb">
          <a routerLink="/">Home</a>
          <span aria-hidden="true">›</span>
          <span aria-current="page">Destinations</span>
        </nav>
        <h1>Destinations</h1>
        <p class="lead">From the high passes of Ladakh to the forts of Rajasthan.</p>
      </div>
    </section>

    <div class="container page">
      @for (region of catalog.regions(); track region.id) {
        <section class="region">
          <app-destination-card class="wide" [destination]="region" />
          <div class="places">
            <h2>{{ region.name }}</h2>
            <p>{{ region.description }}</p>
            @if (catalog.children(region).length) {
              <div class="children">
                @for (place of catalog.children(region); track place.id) {
                  <a [routerLink]="['/destinations', place.slug]">
                    <strong>{{ place.name }}</strong>
                    <span>{{ place.summary }}</span>
                  </a>
                }
              </div>
            }
            <a class="link-arrow" [routerLink]="['/destinations', region.slug]">
              Explore {{ region.name }}
            </a>
          </div>
        </section>
      } @empty {
        <div class="skeleton" style="height: 320px"></div>
      }
    </div>
  `,
  styles: `
    .page {
      display: grid;
      gap: 2.5rem;
      padding-block: 2rem 3rem;
    }
    .region {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
      gap: 2rem;
      align-items: center;
    }
    .region:nth-child(even) app-destination-card {
      order: 2;
    }
    h2 {
      margin-bottom: 0.5rem;
    }
    .places > p {
      color: var(--text-2);
    }
    .children {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.6rem;
      margin: 1rem 0 1.25rem;
    }
    .children a {
      padding: 0.75rem 0.9rem;
      text-decoration: none;
      background: var(--surface);
      border-radius: var(--radius-sm);
      transition: background 0.2s;
    }
    .children a:hover {
      background: var(--accent-soft);
    }
    .children strong {
      display: block;
    }
    .children span {
      font-size: 0.82rem;
      color: var(--muted);
    }
    @media (max-width: 800px) {
      .region {
        grid-template-columns: 1fr;
      }
      .region:nth-child(even) app-destination-card {
        order: 0;
      }
      .children {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class Destinations {
  readonly catalog = inject(CatalogService);

  constructor() {
    inject(SeoService).set({
      title: 'Destinations',
      description:
        'Ladakh, Kashmir, Himachal Pradesh, Spiti, Uttarakhand and Rajasthan: where we ride and drive, and the best time to go.',
      path: '/destinations',
    });
  }
}
