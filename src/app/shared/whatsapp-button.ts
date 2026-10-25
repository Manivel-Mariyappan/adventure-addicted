import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WhatsappService } from '../core/services/whatsapp.service';
import { Icon } from './icons';

// Falls back to the contact page until a WhatsApp number is set.
@Component({
  selector: 'app-whatsapp-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  host: { style: 'display:contents' },
  template: `
    @if (href(); as url) {
      <a
        class="btn"
        [class]="variantClass()"
        [href]="url"
        target="_blank"
        rel="noopener"
        [attr.aria-label]="ariaLabel() || null"
      >
        <app-icon name="whatsapp" />{{ label() }}
      </a>
    } @else {
      <a
        class="btn"
        [class]="variantClass()"
        routerLink="/contact"
        [attr.aria-label]="ariaLabel() || null"
      >
        <app-icon name="whatsapp" />{{ label() }}
      </a>
    }
  `,
})
export class WhatsappButton {
  private readonly whatsapp = inject(WhatsappService);

  readonly message = input.required<string>();
  readonly label = input('Enquire on WhatsApp');
  readonly ariaLabel = input('');
  readonly variant = input<'whatsapp' | 'primary' | 'outline' | 'light'>('whatsapp');
  readonly small = input(false);

  readonly href = computed(() => this.whatsapp.link(this.message()));
  readonly variantClass = computed(
    () => `btn btn-${this.variant()}${this.small() ? ' btn-sm' : ''}`,
  );
}
