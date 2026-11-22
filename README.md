# Adventure Solitaire

A TypeScript browser solitaire adventure. Each encounter deals from a single 54-card deck of six suits. The seven columns start three cards deep in the first encounter, four in the second, and five in the third. Clear them by matching ranks one step above or below the active card. Rank 1 is printed as 1/10 and connects 9 and 2.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the URL Vite prints. Use `npm run build` to type-check and build the static site in `dist/`. Your run saves in the current browser.

Click an exposed matching card. Click the stock or press **D** to draw when needed. Each match or draw, including the opening card, gives one energy of that card's suit. Starting health is 10 HP. Each draw from the pile during play deals 1, 2, or 3 damage depending on the guardian. Each match after the fifth in a streak earns gold equal to the current streak minus five.

| Suit | Power | Effect |
| --- | --- | --- |
| Str | Grapple | Lower the selected card one rank, wrapping 1/10 to 9. |
| Int | Tactical | Move an exposed card with another card behind it into the first empty column. |
| Wis | Perceive | Show the rank and suit of the card immediately behind the selected card. |
| Dex | Equip | Spend 2 Dex energy and 1 gold to give another suit 1 energy. Choose the suit by tapping its icon. |
| Con | Recover | Restore 1 HP, up to 10. |
| Chr | Dazzle | Block the guardian's damage on the next draw. |

Powers cost two energy of their own suit and leave the active card in place. Equip also costs one gold. Clearing an encounter restores up to 3 HP and advances to a newly shuffled deck.
