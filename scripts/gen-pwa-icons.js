/**
 * scripts/gen-pwa-icons.js
 *
 * Generates the square PWA icons required for install-to-home-screen from
 * public/logo.jpg. Android needs a real >=192px icon before it will offer the
 * install prompt, and iOS only allows web push inside an installed PWA — so
 * without these, phone push cannot be enabled at all.
 *
 *   node scripts/gen-pwa-icons.js
 */
const path = require('path')
const fs = require('fs')
const sharp = require('sharp')

const SRC = path.join(__dirname, '..', 'public', 'logo.jpg')
const OUT_DIR = path.join(__dirname, '..', 'public', 'icons')
const BG = '#0a0a0a' // must match manifest background_color

async function main() {
  if (!fs.existsSync(SRC)) throw new Error(`Missing source image: ${SRC}`)
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const meta = await sharp(SRC).metadata()
  console.log(`source: logo.jpg ${meta.width}x${meta.height}`)

  // Standard icons: letterbox the logo into a square on the brand background.
  for (const size of [192, 512]) {
    const out = path.join(OUT_DIR, `icon-${size}.png`)
    await sharp(SRC)
      .resize(size, size, { fit: 'contain', background: BG })
      .png()
      .toFile(out)
    console.log(`wrote icons/icon-${size}.png`)
  }

  // Maskable icon: Android crops to a circle/squircle, so the logo must sit
  // inside the ~80% safe zone or the edges get clipped.
  const MASK = 512
  const inner = Math.round(MASK * 0.6)
  const logo = await sharp(SRC)
    .resize(inner, inner, { fit: 'contain', background: BG })
    .png()
    .toBuffer()
  await sharp({
    create: { width: MASK, height: MASK, channels: 4, background: BG },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toFile(path.join(OUT_DIR, 'icon-maskable-512.png'))
  console.log('wrote icons/icon-maskable-512.png')

  // iOS home-screen icon: 180x180, no transparency, no maskable padding.
  await sharp(SRC)
    .resize(180, 180, { fit: 'contain', background: BG })
    .flatten({ background: BG })
    .png()
    .toFile(path.join(OUT_DIR, 'apple-touch-icon.png'))
  console.log('wrote icons/apple-touch-icon.png')
}

main().catch((err) => { console.error(err.message); process.exit(1) })
