import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { APP_CONFIG } from '../config/app-config';
import { CompanySettings } from '../models';

export interface PageMeta {
  title: string;
  description: string;
  // defaults to the current path
  path?: string;
  image?: string;
  type?: 'website' | 'product';
  jsonLd?: object | null;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);

  private get origin(): string {
    return APP_CONFIG.siteUrl || this.doc.location.origin;
  }

  absolute(path: string): string {
    return /^https?:/.test(path) ? path : `${this.origin}/${path.replace(/^\//, '')}`;
  }

  set(page: PageMeta): void {
    const fullTitle = page.title.includes('Adventure Addicted')
      ? page.title
      : `${page.title} | Adventure Addicted`;
    const url = this.absolute(page.path ?? this.doc.location.pathname);
    const image = this.absolute(page.image ?? 'art/share.svg');

    this.title.setTitle(fullTitle);
    this.meta.updateTag({ name: 'description', content: page.description });
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: page.description });
    this.meta.updateTag({ property: 'og:type', content: page.type ?? 'website' });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });

    let canonical = this.doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = this.doc.createElement('link');
      canonical.rel = 'canonical';
      this.doc.head.appendChild(canonical);
    }
    canonical.href = url;

    this.setJsonLd('page', page.jsonLd ?? null);
  }

  setBusiness(settings: CompanySettings): void {
    this.setJsonLd('business', {
      '@context': 'https://schema.org',
      '@type': 'TravelAgency',
      name: settings.companyName,
      url: this.origin,
      image: this.absolute('art/share.svg'),
      telephone: settings.phone || undefined,
      email: settings.email || undefined,
      address: settings.offices.map((o) => ({
        '@type': 'PostalAddress',
        name: o.name,
        streetAddress: o.address || undefined,
        addressLocality: o.city || undefined,
        addressRegion: o.state || undefined,
        postalCode: o.postalCode || undefined,
        addressCountry: 'IN',
      })),
    });
  }

  private setJsonLd(id: string, data: object | null): void {
    const selector = `script[data-ld="${id}"]`;
    let el = this.doc.head.querySelector<HTMLScriptElement>(selector);
    if (!data) {
      el?.remove();
      return;
    }
    if (!el) {
      el = this.doc.createElement('script');
      el.type = 'application/ld+json';
      el.dataset['ld'] = id;
      this.doc.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
  }
}
