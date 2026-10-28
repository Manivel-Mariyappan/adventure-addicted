import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Coordinator } from '../core/models';
import { assetUrl } from '../core/utils/url';

// The coordinator's photo, or the first letter of their name when there is none.
@Component({
  selector: 'app-coordinator-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    @if (coordinator().photo) {
      <img [src]="assetUrl(coordinator().photo)" alt="" loading="lazy" />
    } @else {
      {{ coordinator().name.charAt(0) }}
    }
  `,
  styles: `
    :host {
      display: grid;
      place-items: center;
      flex: none;
      width: 3.2rem;
      height: 3.2rem;
      overflow: hidden;
      font-family: var(--font-head);
      font-size: 1.3rem;
      font-weight: 700;
      color: #fff;
      background: var(--accent);
      border-radius: 50%;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,
})
export class CoordinatorAvatar {
  readonly coordinator = input.required<Coordinator>();
  readonly assetUrl = assetUrl;
}
