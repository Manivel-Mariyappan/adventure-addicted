// "LED Bulb 9W" becomes "led-bulb-9w"
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD') // so accents can be stripped below
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-');
}

// Paths in the JSON files are relative ("demo/products/bulb.svg"); make them root-relative.
export function assetUrl(path: string): string {
  const isAlreadyUsable = /^(https?:|data:|blob:|\/)/.test(path);
  return isAlreadyUsable ? path : `/${path}`;
}
