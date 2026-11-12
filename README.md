# ORB DERBY — Marble Race Picker

**English** | [한국어](README.ko.md)

Type in some names and each person gets a marble. The marbles tumble down a 3D obstacle tower, and the finish order picks the winner.

**Play:** https://chictimin.github.io/orb-derby/ (English or Korean is picked from your browser language. Switch any time with the KO/EN button.)

## How to play

1. Add players in the lobby.
   - **Type names** tab: 2–40 names, separated by new lines or commas.
   - **QR join** tab: players scan the on-screen QR code with their phone and send their name. It shows up in the list right away.
2. Choose the mode with the **First to finish wins** toggle. When it is on, the first marble to finish wins. When it is off, the last marble still on the course is picked.
3. Press **Start**. After a 3-2-1 countdown, every marble drops into the starting funnel at once.
4. A notice pops up the moment a winner is decided. The race keeps going until everyone finishes, then the full ranking is shown.

## The course

The course is a tower built from top to bottom. Marbles free-fall from one section into the next.

| # | Section | What happens |
|---|---|---|
| 1 | Starting funnel | Everyone drops in together. A spinning stirrer mixes up the order |
| 2 | Square channel | Zigzag channel with a rotating sweeper bar and a trapdoor that opens on a timer (a shortcut to the level below) |
| 3 | Pipe | A filter funnel splits marbles between a translucent spiral pipe and a shortcut chute |
| 4 | Seesaw | Tilting seesaw and a back-and-forth pusher |
| 5 | Pinball | Bumpers, a pin grid, and lucky holes that drop straight toward the finish |
| 6 | Finale | A spinning turntable and the finish arch |

A marble that falls off the track goes back to the middle of the track, about a second before where it fell. A marble stuck for more than 3 seconds goes back to the last checkpoint it passed. There is no time limit.

## Controls

| Action | How |
|---|---|
| Speed / pause | HUD buttons, keys 1–4 / P or Space |
| Follow a player | Click a name in the leaderboard or the player list on the right. Click again to go back to the automatic camera |
| Free camera | "Free camera", then drag to rotate and zoom |
| Music | Mute button or M, volume slider |
| High quality | Add `?quality=high` to the URL |
| Language | KO/EN button, or `?lang=en` / `?lang=ko` |

## Accessibility

- Text contrast meets WCAG AA (4.5:1 for normal text, 3:1 for large text).
- The leaderboard is a real list. Race start, the winner, top-3 finishes, and results are announced to screen readers. The floating marble labels are hidden from screen readers.
- You can pause the race. If your system has "reduce motion" turned on, the camera orbit and confetti are turned off.
- Music does not play until your first click or key press.

## QR join (peer-to-peer)

The players' phones connect to the host screen over WebRTC, through the public [PeerJS](https://peerjs.com/) server. Names travel directly between browsers, and the public server only helps set up the connection. Some office networks and public Wi-Fi block WebRTC. If joining fails there, use the Type names tab.

## Development

```bash
npm install
npm run dev        # http://localhost:5317 (phones on the same Wi-Fi use the Network URL)
npm run build      # type check + build (dist/)
```

Every push to `main` is deployed to GitHub Pages by GitHub Actions.

A headless simulator checks the course without a browser.

```bash
npx tsx scripts/sim.ts --n 20 --runs 3 --seed 1 --timeout 400          # whole tower
npx tsx scripts/sim.ts --sections pipe --n 20 --runs 3 --timeout 60    # one section
npx tsx scripts/sim.ts ... --why                                       # print where marbles fell or got stuck
```

In the output, `finished` is how many marbles finished, `outs` counts falls off the track, `kicks` counts stuck-marble resets, and `rho` is the correlation between the ranking at 5 seconds and the final ranking. A lower `rho` means more comebacks.

### Layout

```
src/
  main.ts            physics loop, ranking and winner logic, fall/stuck resets, name labels
  types.ts           contracts between modules
  i18n.ts            language detection, KO/EN switch, t()
  i18n-dict.ts       Korean and English strings
  course/
    assemble.ts      stacks the sections into a tower, progress and finish checks
    kit.ts           section-building helpers (smooth ramps, funnels, ribbon walls)
    sections/*.ts    one file per section (collected automatically)
  camera.ts          automatic broadcast-style camera
  ui.ts              lobby, HUD, results
  party/             QR join (PeerJS)
  audio.ts           background music
  analytics.ts       Google Tag Manager / GA4 (production only, no player names)
scripts/sim.ts       headless simulator
```

Built with TypeScript, [Three.js](https://threejs.org/), [Rapier](https://rapier.rs/) (physics), and Vite.

## Credits

All music is CC0 by MintoDog. Full details are in [`public/audio/CREDITS.md`](public/audio/CREDITS.md).

- Joyfully — https://opengameart.org/content/joyfully
- Pure Raceway — https://opengameart.org/content/pure-raceway
