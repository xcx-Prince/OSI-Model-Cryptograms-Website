# OSI Model Cryptogram

This is a small Puzzle Baron–style cryptogram web app styled around the seven OSI model layers. Each level contains a short, plain-language description of its OSI layer, encrypted with a random substitution cipher.

Features
- Seven levels corresponding to OSI layers: Physical → Application.
- Puzzle Baron style grid: each cipher letter in its own box, non-letters shown as-is.
- Auto-fill: guessing a plaintext letter updates every matching encrypted letter.
- Frequency panel shows counts of encrypted letters in the puzzle.
- Sequential unlocking: solve a level to unlock the next.
- Controls: Reset puzzle or reveal a small hint (one correct letter mapping).

Files
- `index.html` — main UI.
- `styles.css` — styles and layer color classes.
- `app.js` — core logic: cipher generation, puzzle objects, UI rendering, interactions.

How to run
1. Open `index.html` in a browser (double-click or use "Open with" in your editor).
2. Click the level button to play (levels unlock sequentially).

Notes and limitations
- Ciphers are randomly generated on page load. Refresh to get new encryptions.
- This is a minimal single-file app for demonstration. You can extend it with persistent progress, better UX for mapping conflicts, and improved styling.
