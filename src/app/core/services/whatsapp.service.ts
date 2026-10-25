import { Injectable, computed, inject } from '@angular/core';
import { ContentStore } from './content-store';

// "+91 98765-43210" becomes "919876543210"
export function normaliseWhatsappNumber(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\D/g, '');
}

// null when no WhatsApp number is set up yet
export function whatsappUrl(number: string | null | undefined, message: string): string | null {
  const digits = normaliseWhatsappNumber(number);
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export const enquiryMessages = {
  general: (company: string) => `Hello ${company}, I would like to know more about your tours.`,
  tour: (tourName: string, departure?: string) =>
    departure
      ? `Hello, I am interested in ${tourName} departing ${departure}. Please share the details.`
      : `Hello, I am interested in ${tourName}. Please share the upcoming dates and details.`,
  destination: (name: string) =>
    `Hello, I am planning a trip to ${name}. Which of your tours would you suggest?`,
  cancel: (ref: string, reason: string) =>
    `Hello, I would like to cancel booking ${ref}.${reason ? ` Reason: ${reason}.` : ''} Please confirm the refund as per the policy.`,
  payment: (ref: string, amount: string) =>
    `Hello, I would like to pay ${amount} for booking ${ref}. Please share the payment details.`,
};

@Injectable({ providedIn: 'root' })
export class WhatsappService {
  private readonly store = inject(ContentStore);

  readonly number = computed(() => normaliseWhatsappNumber(this.store.settings()?.whatsappNumber));
  readonly configured = computed(() => this.number().length >= 8);

  link(message: string): string | null {
    return whatsappUrl(this.number(), message);
  }

  generalLink(): string | null {
    return this.link(
      enquiryMessages.general(this.store.settings()?.companyName ?? 'Adventure Addicted'),
    );
  }
}
