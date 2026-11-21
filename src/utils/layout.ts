// Height the floating tab bar occupies above the safe area (bar 60 + gap 16).
// Screens pad their scroll content by this plus insets.bottom so the bar never
// sits on top of the content.
export const TAB_BAR_OFFSET = 76;

/** Poster ratio shared with inkuru (248x352). */
export const COVER_ASPECT_RATIO = 248 / 352;

export const CARD_WIDTH_CONFIG = { columns: 3, gap: 12, horizontalPad: 20 };

export function calcCardWidth(screenWidth: number): number {
  const { columns, gap, horizontalPad } = CARD_WIDTH_CONFIG;
  const available = screenWidth - horizontalPad * 2 - gap * (columns - 1);
  return available / columns;
}
