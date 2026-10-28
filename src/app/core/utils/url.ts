// "LED Bulb 9W" becomes "led-bulb-9w"
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD') // so accents can be stripped below
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-');
}

// Paths in the JSON files are relative ("art/leh.svg"). Keep them relative so they resolve
// against <base href>, which lets the site run at a domain root or under a sub-path
// (GitHub Pages). An old root-relative "/art/leh.svg" loses its leading slash for the same reason.
export function assetUrl(path: string): string {
  return path.replace(/^\/(?!\/)/, '');
}
