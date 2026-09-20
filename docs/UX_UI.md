# UX_UI

## Principles

1. **Every question has a visible answer.** "Which word is one letter away?"
   is answered by empty recipe tiles. "What is coming?" by the incoming-letters
   panel. "Is my chain alive?" by the chain box pulse. Nothing important is
   behind a tooltip or memory.
2. **No meta text.** The player never reads engine, build or version chatter.
   No "beta", no debug counters, no prose explaining rules the HUD already
   shows. Tutorial text is one line, in fiction, and disappears.
3. **Colour is never the only signal.** Every colour-coded state also has a
   shape, label or badge.
4. **Mouse + keyboard first, gamepad-ready.** All interactive elements are
   registered as hit regions with stable ids (`hud.wild`, `hud.speed`, …) so a
   focus system can drive them without touching draw code.

## Battle HUD

Authored at 1920×1080; all regions are exported constants from
`src/ui/battleHud.ts` so the harness can click them by id.

```
┌──────────────────────────────────────────────────────────────────────┐
│ encounter name / ĐỢT 1/8      CHUỖI ×3      1×  ⏸   wave: CÒN LẠI 4  │  y 14–82
│ hint line (one sentence, then gone)                                  │  y 92–130
│                                                                      │
│                        battlefield (depth floor)                     │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│ CÔNG THỨC (3 recipe cards)              │ CHỮ SẼ RƠI (incoming)       │  y 622–722
├──────────────────────────────────────────────────────────────────────┤
│ TÚI CHỮ │ KHO CHỮ (shared pool)         │ ?  wildcard (charge + word) │  y 730–800
└──────────────────────────────────────────────────────────────────────┘
```

Region constants: `CARD {24,622,300,100}`, `INCOMING {984,622,432,100}`,
`BAGBOX {24,730,250,70}`, `TRAY {286,730,834,70}` (`trayInner` = x+96),
`WILD_RECT {1132,730,284,70}`, `STRIP {60,14,580,68}`, `CHAIN_BOX {656,14,112,68}`,
`CONTROLS {784,26,196,44}`, `HINT {60,92,580,38}`.

### Recipe cards

Each card shows the word, its Vietnamese name, and the tiles currently covered by
the pool. Covered tiles are lit; missing tiles are dashed. Below the tiles sits
the deficit (`thiếu B`, `thiếu F K E`, `thiếu E ×2`) — counted, not repeated
glyphs. On a crowded row the deficit is suppressed rather than allowed to
collide with anything.

### The wildcard

Never a mystery button. It states its charge count (`1`), the word it would fill
(`BOMB`) and the exact letter it would supply (`thiếu B`). When spent it reads
`Đã dùng` and dims. When no word is one letter away it reads `Chưa có từ nào
thiếu 1 chữ`.

### The incoming panel

`CHỮ SẼ RƠI` lists guaranteed letters as tiles, and states how many carriers are
unknown (`2 kẻ chưa rõ chữ`). This is the mitigation for randomness: the player
can see the promise and plan around the uncertainty.

## Other screens

| Screen | Job |
| --- | --- |
| Title | Name, one-line premise, demo of the loop running behind the menu, Play/Codex/Settings |
| Kit select | Three loadouts with bag, recipes and core HP laid out side by side |
| Spoils | 1-of-3 reward, each option showing the physical thing it changes |
| Summary | Run result, chapters cleared, best chain, per-blueprint craft contribution |
| Codex | Discovery record: letters, blueprints, enemies, rules |
| Settings | Audio, comfort, language, pacing, reset progress (two-step confirm) |
| Pause | Overlay: resume, restart, settings, quit |

## Language

Vietnamese is the default and the priority. Domain vocabulary is Vietnamese
first with English recipe words kept as Latin gameplay tokens:

| Concept | Vietnamese |
| --- | --- |
| core | Lõi |
| blueprint / recipe | Công thức |
| bag | Túi chữ |
| pool | Kho chữ |
| chain | Chuỗi |
| encounter | Đợt |
| wildcard | Chữ đại diện `?` |
| breach | Đột phá |

Wording was authored in Vietnamese, not translated from English, and needs a
native-review pass before being considered final.

## Onboarding

The brief's hardest requirement was that a new player must understand the loop
without being taught it. Three devices do the work:

1. **The first encounter teaches by pool composition.** Chapter 1's opening pool
   contains only `B`, `O`, `M` — the player completes `BOMB` by doing nothing
   clever, and the resulting bomb teaches the causal link.
2. **Recipe cards stay lit and legible**, so the connection between the pool
   below and the word above is spatial, not textual.
3. **One hint line per encounter**, in fiction (`Kẻ địch mang chữ. Hãy họ để lấy
   chữ về kho.`), which fades after the first few seconds.

## Accessibility / comfort

Colour-blind-safe event palette, reduced-motion option for screen shake and
pulses, language toggle, and no reliance on audio for state. Full contrast audit
of the HUD palette is on the roadmap, not done.
