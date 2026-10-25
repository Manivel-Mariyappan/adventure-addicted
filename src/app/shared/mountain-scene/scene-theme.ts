import type { SceneTheme } from './mountain-engine';

const BY_REGION: Record<string, SceneTheme> = {
  ladakh: 'ladakh',
  kashmir: 'kashmir',
  'himachal pradesh': 'himachal',
  uttarakhand: 'uttarakhand',
  rajasthan: 'rajasthan',
};

// the look of the 3D scene for a destination's region; Ladakh for anything new
export const themeFor = (region: string | undefined): SceneTheme =>
  BY_REGION[(region ?? '').toLowerCase()] ?? 'ladakh';
