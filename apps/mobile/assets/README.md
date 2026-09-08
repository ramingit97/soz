# Söz mobile assets

This folder contains placeholder icons + splash for the build pipeline.
Real designs should replace these before App Store / Play Store submission.

Required PNG sizes:
- icon.png: 1024×1024 (no transparency, no rounded corners)
- adaptive-icon.png: 1024×1024 (Android, foreground only)
- splash.png: 1242×2436 (iPhone X, scales to others)

To convert the SVGs to PNGs:
  pnpm dlx sharp-cli -i icon.svg -o icon.png
  pnpm dlx sharp-cli -i adaptive-icon.svg -o adaptive-icon.png
  pnpm dlx sharp-cli -i splash.svg -o splash.png

Or use an online tool like https://cloudconvert.com/svg-to-png
