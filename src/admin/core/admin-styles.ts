import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';

const LINK_ID = 'aac-portal-css';
// "admin" style bundle in angular.json
const HREF = 'admin.css';

// Bootstrap is only loaded while the admin is open, so it never touches the website.
// app.ts removes the stylesheet and the aac-portal class again when leaving /admin.
export const adminStylesGuard: CanActivateFn = () => {
  const doc = inject(DOCUMENT);
  doc.documentElement.classList.add('aac-portal');
  const existing = doc.getElementById(LINK_ID) as HTMLLinkElement | null;
  if (existing) return true;
  const link = doc.createElement('link');
  link.id = LINK_ID;
  link.rel = 'stylesheet';
  link.href = HREF;
  doc.head.appendChild(link);
  // Wait for the CSS so the page doesn't flash unstyled.
  return new Promise<boolean>((resolve) => {
    link.onload = () => resolve(true);
    link.onerror = () => {
      console.error(
        `[admin] Could not load ${HREF}. If you are running "ng serve", restart it after changes to angular.json.`,
      );
      resolve(true);
    };
  });
};
