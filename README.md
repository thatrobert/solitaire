# Adventure Solitaire

A TypeScript browser solitaire adventure. Each encounter uses two separately shuffled 54-card decks of six suits. The scenario deck supplies the tableau, Ancient Ruins stack additions, and guardian draws. The player deck supplies the opening active card and Ancient Ruins player draws. A new run opens in Ancient Ruins with two rows across all seven columns. One random face-down card is The Door and the other six carry bombs. The seven exposed cards are regular cards. The four guardians follow, filling the middle five columns with four, five, six, and seven rows, respectively. Clear the columns by matching ranks one step above or below the active card. Rank 1 is printed as 1/10 and connects 9 and 2.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the URL Vite prints. Use `npm run build` to type-check and build the static site in `dist/`. Your run saves in the current browser.

Click an exposed matching card. Click the stock or press **D** to draw when needed. Each suited card matched or drawn, including the opening card, gives one energy of its suit. Starting health is 10 HP. Draws cost 1, 2, 2, and 3 HP against the four guardians, respectively. Each match after the fifth in a streak earns gold equal to the current streak minus five.

In Ancient Ruins, a draw makes a card from the player deck active. If the scenario deck has cards left, the same action adds one to the top of a random column. There is no draw penalty. Each exposed bomb costs 1 HP after a successful match, draw, or power use, including the turn it is uncovered. Covering or removing a bomb stops its damage.

In guardian encounters, each tableau card has a 20% chance of a shield and a 20% chance of a blood drop. A shield absorbs one match or Strike before the card can be removed. Matching a blood-drop card costs 1 HP. Strike removes blood-drop cards safely.

The Fool is a Joker with a 10% chance per tableau slot in guardian encounters. It matches any card and becomes the active card, allowing any exposed card to match next. The Door is a Joker available in encounters that opt in, including Ancient Ruins. Select the exposed Door to choose whether to stay or go straight to the next encounter. If you stay, it remains available to select again. Going through the Door carries over your current HP. Jokers have no suit or rank and award no suit energy. Strike can remove them without activating their abilities.

| Suit | Power | Effect |
| --- | --- | --- |
| Str | Strike | Remove the selected exposed card from the tableau. If it has a suit, gain 1 energy of that suit. |
| Int | Cleave | Move the top half of the leftmost longest stack into the first empty column, rounding down for odd stacks. |
| Wis | Perceive | Show the rank and suit of the nearest hidden card in every stack that has one, skipping cards already revealed. |
| Dex | Equip | Spend Dex energy to give another suit 1 energy. Choose the suit by tapping its icon. |
| Con | Recover | Restore 1 HP, up to 10. |
| Cha | Dazzle | In Ancient Ruins, block the next stack addition. Against guardians, block damage on the next draw. |

Each power rolls a cost of 1 to 6 energy of its own suit at the start of a run and keeps that cost for the whole run. Powers leave the active card in place. Clearing an encounter restores up to 3 HP and advances to an encounter with newly shuffled decks.
