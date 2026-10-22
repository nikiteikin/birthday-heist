# Birthday Heist

Interactive birthday card. Static site (HTML, CSS, vanilla JS), no backend, works on GitHub Pages.

## 1. Personalize
Open `script.js` and edit the `CONFIG` block at the top: `name`, `age`, `message`, `joke`, `note`.
The story text (`INTRO`, `OATH`, `VOW`, `BRIEF`, `MORGANA_FINAL`) sits right below it.

## 2. Run locally
Open `index.html` in a browser, or run `python -m http.server` in this folder and visit http://localhost:8000.
Jump straight to a scene while developing: `index.html?scene=maze` (also `card`, `reveal`, `brief`, `final`).

## 3. Deploy to GitHub Pages
1. Push this folder to a GitHub repository.
2. Settings > Pages > Deploy from a branch > `main` / root.
3. Send the resulting URL.

## 4. Replace placeholders (all optional)
Everything works without these files. Add them later with the same names and they are picked up automatically.

| Placeholder now | Drop-in file |
|---|---|
| Impact / Arial Black headings | `fonts/persona-font.ttf` |
| (done) Morgana helper image | `assets/characters/morgana.png` is included |
| Synthesized beeps | `audio/ui/{hover,click,confirm,back}.mp3`, `audio/scenes/{explosion,calling-card,shot,victory}.mp3`, `audio/game/{move,wall,collect,unlock,win}.mp3` |

Background music: put your own track at `audio/music/poem.mp3`. It fades in when the envelope is opened, loops, and fades out as soon as the card is clicked; the ♪ button in the corner mutes it meanwhile. Nothing plays if the file is missing.

Formats: every sound is looked up as `.mp3`, then `.wav`, `.ogg`, `.m4a`, so a `.wav` file works too (WAV is large, so MP3 is better for a website). The music track accepts the same formats.

If a sound file is missing or the browser blocks it, the game falls back to a beep instead of failing.

## 5. Notes
- Audio starts only after the first click on "Begin the operation".
- Maze: arrow keys or WASD on desktop, on-screen D-pad on touch devices. The layout is fixed and always solvable (`MAP` in `script.js`; the number of cards is counted from the map).
- Maze look: the player icon is `assets/characters/player.png`. Walls are flickering binary code; change its colour with `--code-rgb` at the top of `style.css` (`229,23,31` gives red).
- Reveal scene: a results-screen style card. `assets/reveal/` holds the layers (`bg`, `char`, `l1`-`l4` for the name letters); the grayscale look, red bolts and the "Lvl 29" starburst are CSS. Every piece lands with a gunshot sound, then a gloss sweep runs.
- Villain: a Shadow patrols the right and bottom corridors (`PATROL` in `script.js`). Touching it starts a turn-based fight in Persona 5 Royal style (the `Battle` section of `script.js`, enemy art in `assets/enemy/shadow.png`). Win and the Shadow is gone. Lose and the maze restarts. Test the fight directly with `index.html?scene=battle`.
- Not in v1.0: moving enemies, background music loop, separate `docs/` folder.
- If you use official Persona art or audio, treat it as a fan-project asset and keep the site private.

## 6. Phones (iPhone 17, 17 Pro, 17 Pro Max, Safari)
- The layout uses safe areas (notch, Dynamic Island, home bar), `svh` units and touch-friendly buttons. The on-screen D-pad replaces the keyboard in the maze.
- Landscape on a phone shows a "ROTATE YOUR PHONE" screen. The game is built for portrait.
- Safari ignores audio volume, so on iPhone the music starts at full track volume and stops without a fade. Keep the mp3 at a moderate loudness. Synthesized sounds follow the iPhone silent switch.
- iPhone has no Impact font. Put a bold condensed font at `fonts/persona-font.ttf` for the same look on every device.
- For a full-screen app feel: Share > Add to Home Screen.
