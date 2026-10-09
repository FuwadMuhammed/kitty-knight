// Text rendering mode. true = Google "Pixelify Sans" (self-hosted in public/fonts), false = original 3x5 bitmap font.
// Flip this one flag to revert every piece of text in the game.
export const WEB_FONT = true;
// In-game canvas text (HUD, bubbles) is only 5px tall on the 320x180 buffer; a vector font turns to mush there, so keep the bitmap font.
export const CANVAS_WEB_FONT = false;
export const FONT_FAMILY = '"VT323", "Pixelify Sans", monospace';
/** CSS px per glyph-scale step in React UI (bitmap glyph was 5 tall x s). */
export const UI_FONT_PX = 8.5;
export const UI_FONT_WEIGHT = 400;
/** Canvas font size for 1x text (drawn on the 320x180 buffer). */
export const CANVAS_FONT_PX = 7;
