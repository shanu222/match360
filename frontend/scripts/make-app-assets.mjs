// Builds the source images for `npx capacitor-assets generate --android` from the Match360 logo (public/logo.svg).
// Run: node scripts/make-app-assets.mjs && npx capacitor-assets generate --android
import sharp from 'sharp';

const BLUE = '#2541D8';
// The logo mark (two rings and their overlap) on a 64x64 canvas, without the tile.
const mark = `<path d="M32 20.5a14 14 0 0 1 0 23a14 14 0 0 1 0-23z" fill="#FFD84D"/><circle cx="24" cy="32" r="14" fill="none" stroke="#fff" stroke-width="4.5"/><circle cx="40" cy="32" r="14" fill="none" stroke="#fff" stroke-width="4.5"/>`;
// `scale` is how much of the canvas the 64-unit artboard fills.
const svg = (size, scale, bg) => {
  const s = (size * scale) / 64;
  const o = (size - 64 * s) / 2;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ''}<g transform="translate(${o} ${o}) scale(${s})">${mark}</g></svg>`);
};

await sharp(svg(1024, 1, BLUE)).png().toFile('assets/icon-only.png');
// Adaptive icon: the mark must stay inside the centre 66% safe zone.
await sharp(svg(1024, 0.62, null)).png().toFile('assets/icon-foreground.png');
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BLUE } }).png().toFile('assets/icon-background.png');
await sharp(svg(2732, 0.2, BLUE)).png().toFile('assets/splash.png');
await sharp(svg(2732, 0.2, BLUE)).png().toFile('assets/splash-dark.png');
console.log('assets/ written');
