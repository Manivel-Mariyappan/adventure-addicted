import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { WhatsappService } from '../../core/services/whatsapp.service';
import { Icon } from '../icons';

@Component({
  selector: 'app-whatsapp-fab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    @if (href(); as url) {
      <a [href]="url" target="_blank" rel="noopener" aria-label="Chat with us on WhatsApp">
        <app-icon name="whatsapp" [size]="30" />
        <span class="label">Chat with us</span>
      </a>
    }
  `,
  styleUrl: './whatsapp-fab.scss',
})
export class WhatsappFab {
  private readonly whatsapp = inject(WhatsappService);
  readonly href = computed(() => this.whatsapp.generalLink());
}
