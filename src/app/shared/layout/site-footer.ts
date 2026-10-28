import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';
import { ContentStore } from '../../core/services/content-store';
import { WhatsappService } from '../../core/services/whatsapp.service';
import { officeAddress } from '../../core/utils/offices';
import { Icon } from '../icons';

@Component({
  selector: 'app-site-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  templateUrl: './site-footer.html',
  styleUrl: './site-footer.scss',
})
export class SiteFooter {
  private readonly whatsapp = inject(WhatsappService);
  readonly settings = inject(ContentStore).settings;
  readonly logo = inject(ContentStore).logo;
  readonly regions = inject(CatalogService).regions;

  readonly year = new Date().getFullYear();
  readonly whatsappHref = computed(() => this.whatsapp.generalLink());
  readonly offices = computed(() =>
    (this.settings()?.offices ?? []).map((o) => ({ name: o.name, address: officeAddress(o) })),
  );
  readonly socials = computed(() => {
    const s = this.settings();
    if (!s) return [];
    return [
      { icon: 'instagram' as const, url: s.instagram, label: 'Instagram' },
      { icon: 'youtube' as const, url: s.youtube, label: 'YouTube' },
      { icon: 'facebook' as const, url: s.facebook, label: 'Facebook' },
    ].filter((x) => x.url);
  });
}
