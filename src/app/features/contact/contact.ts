import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ContentStore } from '../../core/services/content-store';
import { SeoService } from '../../core/services/seo.service';
import { WhatsappService, enquiryMessages } from '../../core/services/whatsapp.service';
import { Icon } from '../../shared/icons';
import { WhatsappButton } from '../../shared/whatsapp-button';

@Component({
  selector: 'app-contact',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, WhatsappButton],
  template: `
    <section class="banner">
      <div class="container">
        <nav class="crumbs" aria-label="Breadcrumb">
          <a routerLink="/">Home</a>
          <span aria-hidden="true">›</span>
          <span aria-current="page">Contact</span>
        </nav>
        <h1>Talk to us</h1>
        <p class="lead">
          Questions about a route, the bikes or bringing your own car? Message us on WhatsApp or
          call.
        </p>
      </div>
    </section>

    @if (settings(); as s) {
      <div class="container grid">
        <div class="cards">
          <article class="card item">
            <app-icon name="whatsapp" [size]="22" />
            <div>
              <h2>WhatsApp</h2>
              @if (whatsapp.configured()) {
                <p>{{ whatsappDisplay() }}</p>
                <app-whatsapp-button
                  [message]="message()"
                  label="Chat on WhatsApp"
                  [small]="true"
                />
              } @else {
                <p>Coming soon. Please call us for now.</p>
              }
            </div>
          </article>
          @if (s.phone) {
            <article class="card item">
              <app-icon name="phone" [size]="22" />
              <div>
                <h2>Phone</h2>
                <p>
                  <a [href]="'tel:' + s.phone">{{ s.phone }}</a>
                </p>
                @if (s.officeHours) {
                  <p class="muted">{{ s.officeHours }}</p>
                }
              </div>
            </article>
          }
          @if (s.email) {
            <article class="card item">
              <app-icon name="mail" [size]="22" />
              <div>
                <h2>Email</h2>
                <p>
                  <a [href]="'mailto:' + s.email">{{ s.email }}</a>
                </p>
              </div>
            </article>
          }
          @if (address()) {
            <article class="card item">
              <app-icon name="pin" [size]="22" />
              <div>
                <h2>Office</h2>
                <p>{{ address() }}</p>
                <a class="link-arrow" [href]="directionsUrl()" target="_blank" rel="noopener"
                  >Directions</a
                >
              </div>
            </article>
          }
        </div>

        @if (address()) {
          <iframe
            class="map"
            [src]="mapUrl()"
            [title]="'Map showing ' + s.companyName"
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
          ></iframe>
        } @else {
          <div class="card note">
            <h2>Already booked?</h2>
            <p>
              Your booking reference, payments and coordinator details are on
              <a routerLink="/my-trips">My trips</a>.
            </p>
          </div>
        }
      </div>
    }
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: 1fr 1.2fr;
      gap: 1.5rem;
      align-items: start;
      padding-block: 2rem 3rem;
    }
    .cards {
      display: grid;
      gap: 0.75rem;
    }
    .item {
      display: flex;
      gap: 1rem;
      padding: 1.1rem 1.2rem;
    }
    .item > app-icon {
      display: grid !important;
      place-items: center;
      flex: none;
      width: 2.6rem;
      height: 2.6rem;
      color: var(--accent);
      background: var(--accent-soft);
      border-radius: 50%;
    }
    h2 {
      margin: 0 0 0.2rem;
      font-size: 0.8rem;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--muted);
    }
    p {
      margin: 0 0 0.5rem;
      font-weight: 500;
    }
    .muted {
      font-size: 0.85rem;
      font-weight: 400;
      color: var(--muted);
    }
    .map {
      width: 100%;
      min-height: 380px;
      border: 0;
      border-radius: var(--radius);
    }
    .note {
      padding: 1.5rem;
    }
    .note h2 {
      font-size: 1.1rem;
      text-transform: none;
      letter-spacing: 0;
      color: var(--text);
    }
    .note a {
      color: var(--accent-ink);
    }
    @media (max-width: 800px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class Contact {
  private readonly sanitizer = inject(DomSanitizer);
  readonly whatsapp = inject(WhatsappService);
  readonly settings = inject(ContentStore).settings;

  // 919786995053 -> +91 97869 95053
  readonly whatsappDisplay = computed(() => {
    const n = this.whatsapp.number();
    return n.length === 12 && n.startsWith('91') ? `+91 ${n.slice(2, 7)} ${n.slice(7)}` : `+${n}`;
  });
  readonly address = computed(() => {
    const s = this.settings();
    return s ? [s.addressLine1, s.city, s.state, s.postalCode].filter(Boolean).join(', ') : '';
  });
  // safe to trust: the address is URI-encoded, so it can't change the host or path
  readonly mapUrl = computed(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.google.com/maps?q=${encodeURIComponent(this.address())}&output=embed`,
    ),
  );
  readonly directionsUrl = computed(
    () =>
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(this.address())}`,
  );
  readonly message = computed(() =>
    enquiryMessages.general(this.settings()?.companyName ?? 'Adventure Addicted'),
  );

  constructor() {
    inject(SeoService).set({
      title: 'Contact',
      description: 'WhatsApp, phone and email for Adventure Addicted. Ask us about any tour.',
      path: '/contact',
    });
  }
}
