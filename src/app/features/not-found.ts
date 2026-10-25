import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeoService } from '../core/services/seo.service';

@Component({
  selector: 'app-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <section class="section container">
      <div class="state-box">
        <p class="eyebrow">404</p>
        <h1>Wrong turn</h1>
        <p>This page doesn't exist, or the tour has finished for the season.</p>
        <a class="btn btn-primary" routerLink="/tours">See all tours</a>
      </div>
    </section>
  `,
})
export class NotFound {
  constructor() {
    inject(SeoService).set({
      title: 'Page not found',
      description: 'The page you were looking for could not be found.',
    });
  }
}
