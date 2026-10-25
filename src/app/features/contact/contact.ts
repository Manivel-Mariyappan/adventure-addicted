import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ContentStore } from '../../core/services/content-store';
import { SeoService } from '../../core/services/seo.service';
import { WhatsappService, enquiryMessages } from '../../core/services/whatsapp.service';
import { directionsUrl, mapEmbedUrl, officeAddress } from '../../core/utils/offices';
import { Icon } from '../../shared/icons';
import { WhatsappButton } from '../../shared/whatsapp-button';

@Component({
  selector: 'app-contact',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, WhatsappButton],
  templateUrl: './contact.html',
  styleUrl: './contact.scss',
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

  readonly offices = computed(() =>
    (this.settings()?.offices ?? []).map((o) => ({
      ...o,
      fullAddress: officeAddress(o),
      directions: directionsUrl(o),
      // safe to trust: the address is URI-encoded, so it can't change the host or path
      map: this.sanitizer.bypassSecurityTrustResourceUrl(mapEmbedUrl(o)) as SafeResourceUrl,
    })),
  );

  readonly message = computed(() =>
    enquiryMessages.general(this.settings()?.companyName ?? 'Adventure Addicted'),
  );

  constructor() {
    inject(SeoService).set({
      title: 'Contact',
      description: 'WhatsApp, phone, email and our office addresses with maps.',
      path: '/contact',
    });
  }

  tel(phone: string): string {
    return `tel:${phone.replace(/[^\d+]/g, '')}`;
  }
}
