# Adventure Solitaire

A TypeScript browser solitaire adventure. Each encounter deals from a single 54-card deck of six suits. All encounters have seven available columns and fill the middle five with four, five, six, and seven rows, respectively. Clear the columns by matching ranks one step above or below the active card. Rank 1 is printed as 1/10 and connects 9 and 2.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the URL Vite prints. Use `npm run build` to type-check and build the static site in `dist/`. Your run saves in the current browser.

Click an exposed matching card. Click the stock or press **D** to draw when needed. Each match or draw, including the opening card, gives one energy of that card's suit. Starting health is 10 HP. Draws deal 1, 2, 2, and 3 damage in encounters 1 through 4, respectively. Each match after the fifth in a streak earns gold equal to the current streak minus five.

| Suit | Power | Effect |
| --- | --- | --- |
| Str | Strike | Remove the selected exposed card from the tableau, leaving the active card and discard pile alone. |
| Int | Tactical | Move the top half of the leftmost longest stack into the first empty column, rounding down for odd stacks. |
| Wis | Perceive | Show the rank and suit of the nearest hidden card in every stack that has one, skipping cards already revealed. |
| Dex | Equip | Spend 2 Dex energy to give another suit 1 energy. Choose the suit by tapping its icon. |
| Con | Recover | Restore 1 HP, up to 10. |
| Chr | Dazzle | Block the guardian's damage on the next draw. |

Powers cost two energy of their own suit and leave the active card in place. Clearing an encounter restores up to 3 HP and advances to a newly shuffled deck.
