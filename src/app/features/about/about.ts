import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { ContentStore } from '../../core/services/content-store';
import { SeoService } from '../../core/services/seo.service';
import { Icon } from '../../shared/icons';

@Component({
  selector: 'app-about',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  template: `
    <section class="banner">
      <div class="container">
        <nav class="crumbs" aria-label="Breadcrumb">
          <a routerLink="/">Home</a>
          <span aria-hidden="true">›</span>
          <span aria-current="page">About</span>
        </nav>
        <h1>About Adventure Addicted</h1>
        <p class="lead">
          {{
            settings()?.description ||
              'We plan and lead group trips across North India: bike expeditions, self-drive road trips and easy family tours.'
          }}
        </p>
      </div>
    </section>

    <div class="container page">
      <section class="how">
        <h2>How a trip works</h2>
        <ol>
          <li>
            <strong>We plan the route.</strong>
            Every tour has fixed dates, a day-by-day plan, stays booked in advance and a limit on
            the group size.
          </li>
          <li>
            <strong>You choose how to travel.</strong>
            Ride one of our bikes, drive your own car in the convoy, or take a seat in our vehicle.
            Each option has its own price and inclusions.
          </li>
          <li>
            <strong>A coordinator leads the group.</strong>
            One person handles the hotels, permits, timings and any problem on the road, from the
            first day to the last.
          </li>
          <li>
            <strong>You only pay to confirm.</strong>
            Send a request, we confirm the seats, and an advance holds your place. The balance is
            due a few weeks before departure.
          </li>
        </ol>
      </section>

      <section class="numbers">
        <div>
          <strong>{{ catalog.tours().length }}</strong>
          <span>tours</span>
        </div>
        <div>
          <strong>{{ catalog.upcoming().length }}</strong>
          <span>upcoming departures</span>
        </div>
        <div>
          <strong>{{ catalog.destinations().length }}</strong>
          <span>destinations</span>
        </div>
        <div>
          <strong>{{ catalog.coordinators().length }}</strong>
          <span>trip coordinators</span>
        </div>
      </section>

      @if (catalog.coordinators().length) {
        <section>
          <h2>Our coordinators</h2>
          <div class="people">
            @for (c of catalog.coordinators(); track c.id) {
              <article class="card person">
                <span class="avatar" aria-hidden="true">{{ c.name.charAt(0) }}</span>
                <h3>{{ c.name }}</h3>
                <p class="meta">{{ c.experienceYears }} years · {{ c.languages.join(', ') }}</p>
                <p>{{ c.bio }}</p>
              </article>
            }
          </div>
        </section>
      }

      @if (testimonials().length) {
        <section>
          <h2>What our riders say</h2>
          <div class="reviews">
            @for (t of testimonials(); track t.name) {
              <figure>
                <blockquote>{{ t.text }}</blockquote>
                <figcaption>
                  <strong>{{ t.name }}</strong>
                  {{ t.city }} · {{ t.tour }}
                </figcaption>
              </figure>
            }
          </div>
        </section>
      }

      <section class="cta card">
        <app-icon name="mountain" [size]="30" />
        <div>
          <h2>Ready for the mountains?</h2>
          <p>Pick a departure and send your request. It takes two minutes.</p>
        </div>
        <a class="btn btn-cta" routerLink="/tours">See tours</a>
      </section>
    </div>
  `,
  styles: `
    .banner .lead {
      white-space: pre-line;
    }
    .reviews {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
    }
    .reviews figure {
      margin: 0;
      padding: 1.35rem;
      background: var(--surface);
      border-radius: var(--radius);
    }
    .reviews blockquote {
      margin: 0 0 1rem;
      font-size: 0.95rem;
    }
    .reviews figcaption {
      font-size: 0.82rem;
      color: var(--muted);
    }
    .reviews figcaption strong {
      display: block;
      color: var(--text);
    }
    .page {
      display: grid;
      gap: 2.5rem;
      padding-block: 2rem 3rem;
    }
    .how ol {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
      margin: 0;
      padding: 0;
      list-style: none;
      counter-reset: step;
    }
    .how li {
      position: relative;
      padding: 1.25rem 1.25rem 1.25rem 3.75rem;
      color: var(--text-2);
      background: var(--surface);
      border-radius: var(--radius);
      counter-increment: step;
    }
    .how li::before {
      content: counter(step);
      position: absolute;
      top: 1.15rem;
      left: 1.15rem;
      display: grid;
      place-items: center;
      width: 1.9rem;
      height: 1.9rem;
      font-weight: 700;
      color: #fff;
      background: var(--orange);
      border-radius: 50%;
    }
    .how strong {
      display: block;
      margin-bottom: 0.2rem;
      color: var(--text);
    }
    .numbers {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      padding: 1.5rem;
      color: #cbd5e1;
      background: var(--dark);
      border-radius: var(--radius);
    }
    .numbers strong {
      display: block;
      font-family: var(--font-head);
      font-size: 2.2rem;
      color: #fff;
    }
    .people {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
    }
    .person {
      padding: 1.25rem;
    }
    .person h3 {
      margin: 0.75rem 0 0.15rem;
    }
    .person p:last-child {
      margin: 0.5rem 0 0;
      font-size: 0.9rem;
      color: var(--text-2);
    }
    .avatar {
      display: grid;
      place-items: center;
      width: 3.2rem;
      height: 3.2rem;
      font-family: var(--font-head);
      font-size: 1.3rem;
      font-weight: 700;
      color: #fff;
      background: var(--accent);
      border-radius: 50%;
    }
    .cta {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      padding: 1.5rem;
    }
    .cta app-icon {
      color: var(--orange);
    }
    .cta h2 {
      margin: 0;
    }
    .cta p {
      margin: 0.2rem 0 0;
      color: var(--muted);
    }
    .cta .btn {
      margin-left: auto;
    }
    @media (max-width: 800px) {
      .how ol,
      .people,
      .reviews {
        grid-template-columns: 1fr;
      }
      .numbers {
        grid-template-columns: 1fr 1fr;
      }
      .cta {
        flex-direction: column;
        align-items: flex-start;
      }
      .cta .btn {
        margin-left: 0;
      }
    }
  `,
})
export class About {
  readonly catalog = inject(CatalogService);
  readonly settings = inject(ContentStore).settings;
  readonly testimonials = computed(() => this.settings()?.testimonials ?? []);

  constructor() {
    inject(SeoService).set({
      title: 'About us',
      description:
        'Adventure Addicted plans and leads group bike expeditions and road trips across North India.',
      path: '/about',
    });
  }
}
