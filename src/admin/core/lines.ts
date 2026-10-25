// Lists such as highlights or inclusions are edited as one item per line.
export const toLines = (items: string[]): string => items.join('\n');

export const fromLines = (text: string): string[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
