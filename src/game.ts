export const suits = ['str', 'int', 'wis', 'dex', 'con', 'chr'] as const
export type Suit = typeof suits[number]
export const maxHp = 10
export const columns = 7
export const powers = {
  str: { label: 'Str', name: 'Strike', detail: 'Remove an exposed card from the tableau.' },
  int: { label: 'Int', name: 'Tactical', detail: 'Move the top half of the leftmost longest stack to the first empty column. Round down for odd stacks.' },
  wis: { label: 'Wis', name: 'Perceive', detail: 'Reveal the nearest hidden card in each stack that has one.' },
  dex: { label: 'Dex', name: 'Equip', detail: 'Give another suit 1 energy.' },
  con: { label: 'Con', name: 'Recover', detail: 'Restore 1 HP.' },
  chr: { label: 'Chr', name: 'Dazzle', detail: 'Block the guardian’s damage on your next draw.' },
} as const

export const encounters = [
  { name: 'The Brass Sentinel', art: 'sentinel', rows: 4, filledColumns: 5, damage: 1 },
  { name: 'The Tide Keeper', art: 'keeper', rows: 5, filledColumns: 5, damage: 2 },
  { name: 'The Eclipse Regent', art: 'regent', rows: 6, filledColumns: 5, damage: 2 },
  { name: 'The Obsidian Wyrm', art: 'wyrm', rows: 7, filledColumns: 5, damage: 3 },
] as const

export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
export type Card = { id: string; suit: Suit; rank: Rank; revealed: boolean }
export type TargetPower = 'str'
export type Game = {
  stage: number
  hp: number
  dazzled: boolean
  gold: number
  streak: number
  best: number
  energy: Record<Suit, number>
  powerCosts: Record<Suit, number>
  stock: Card[]
  tableau: Card[][]
  active: Card
  spent: Card[]
  phase: 'battle' | 'clear' | 'victory' | 'defeat'
  notice: string
}

export function nextRank(rank: Rank): Rank {
  return rank === 9 ? 1 : (rank + 1) as Rank
}

export function rankText(rank: Rank) {
  return rank === 1 ? '1/10' : String(rank)
}

function consecutive(a: Rank, b: Rank) {
  return nextRank(a) === b || nextRank(b) === a
}

export function makeDeck(): Card[] {
  return suits.flatMap(suit => Array.from({ length: 9 }, (_, index) => ({
    id: `${suit}-${index + 1}`, suit, rank: (index + 1) as Rank, revealed: false,
  })))
}

function deal(stage: number, random: () => number) {
  const deck = makeDeck()
  for (let n = deck.length - 1; n > 0; n--) {
    const index = Math.floor(random() * (n + 1))
    const card = deck[n]
    deck[n] = deck[index]
    deck[index] = card
  }
  const { rows, filledColumns } = encounters[stage]
  const firstFilledColumn = (columns - filledColumns) / 2
  const tableau = Array.from({ length: columns }, (_, column) =>
    column >= firstFilledColumn && column < firstFilledColumn + filledColumns ? deck.splice(0, rows) : [],
  )
  const firstMatch = deck.findIndex(card => tableau.some(stack =>
    stack.length > 0 && consecutive(card.rank, stack[stack.length - 1].rank),
  ))
  const [active] = deck.splice(firstMatch < 0 ? 0 : firstMatch, 1)
  const energy = { str: 0, int: 0, wis: 0, dex: 0, con: 0, chr: 0 }
  energy[active.suit]++
  return {
    tableau,
    active,
    stock: deck,
    spent: [],
    streak: 0,
    dazzled: false,
    energy,
    phase: 'battle' as const,
    notice: 'Match an exposed card one rank above or below the active card.',
  }
}

export function newGame(random = Math.random): Game {
  const powerCosts = Object.fromEntries(suits.map(suit => [suit, 1 + Math.floor(random() * 6)])) as Game['powerCosts']
  return { ...deal(0, random), stage: 0, hp: maxHp, gold: 0, best: 0, powerCosts }
}

export function top(game: Game, column: number) {
  return game.tableau[column]?.at(-1)
}

export function canMatch(game: Game, card: Card) {
  return game.phase === 'battle' && consecutive(game.active.rank, card.rank)
}

function hasTacticalMove(game: Game) {
  return game.tableau.some(stack => !stack.length) && game.tableau.some(stack => stack.length > 1)
}

function nextCoveredCard(stack: Card[]) {
  for (let index = stack.length - 2; index >= 0; index--) {
    if (!stack[index].revealed) return stack[index]
  }
}

export function canPower(game: Game, suit: Suit) {
  if (game.phase !== 'battle') return false
  if (game.energy[suit] < game.powerCosts[suit]) return false
  switch (suit) {
    case 'str': return hasStrikeTarget(game)
    case 'int': return hasTacticalMove(game)
    case 'wis': return game.tableau.some(nextCoveredCard)
    case 'con': return game.hp < maxHp
    case 'dex': return true
    case 'chr': return !game.dazzled && game.stock.length > 0
  }
}

function hasStrikeTarget(game: Game) {
  return game.tableau.some(stack => stack.length > 0)
}

export function canTarget(game: Game, suit: TargetPower, column: number) {
  return canPower(game, suit) && Boolean(top(game, column))
}

function settle(game: Game) {
  const trades = Math.floor(game.energy.dex / game.powerCosts.dex)
  if (game.hp <= 0) {
    game.phase = 'defeat'
    game.notice = 'You ran out of HP.'
  } else if (game.tableau.every(stack => !stack.length)) {
    game.phase = game.stage === encounters.length - 1 ? 'victory' : 'clear'
    game.notice = 'Every column cleared.'
  } else if (!game.stock.length && !(hasStrikeTarget(game) && game.energy.str + trades >= game.powerCosts.str) &&
    !(hasTacticalMove(game) && game.energy.int + trades >= game.powerCosts.int) &&
    !game.tableau.some(stack => stack.length && canMatch(game, stack[stack.length - 1]))) {
    game.phase = 'defeat'
    game.notice = 'No stock or playable cards remain.'
  }
}

function gain(game: Game, card: Card) {
  game.energy[card.suit]++
  game.spent.push(game.active)
  game.active = card
}

export function match(game: Game, column: number) {
  const card = top(game, column)
  if (!card || !canMatch(game, card)) return false
  game.tableau[column].pop()
  gain(game, card)
  game.streak++
  game.best = Math.max(game.best, game.streak)
  game.notice = 'Matched.'
  const goldEarned = Math.max(0, game.streak - 5)
  if (goldEarned) {
    game.gold += goldEarned
    game.notice += ` Streak bonus: +${goldEarned} gold.`
  }
  settle(game)
  return true
}

export function draw(game: Game) {
  if (game.phase !== 'battle' || !game.stock.length) return false
  const card = game.stock.pop()!
  gain(game, card)
  game.streak = 0
  const damage = encounters[game.stage].damage
  const blocked = game.dazzled
  game.dazzled = false
  if (!blocked) game.hp = Math.max(0, game.hp - damage)
  game.notice = blocked ? 'Dazzle blocked the hit.' : `The guardian hit for ${damage} HP.`
  settle(game)
  return true
}

export function cast(game: Game, suit: Suit, column?: number) {
  if (!canPower(game, suit) || suit === 'dex') return false
  if (suit === 'con') {
    game.hp++
    game.notice = 'Recover restored 1 HP.'
  } else if (suit === 'chr') {
    game.dazzled = true
    game.notice = 'Dazzle will block damage on your next draw.'
  } else if (suit === 'str') {
    if (column === undefined || !canTarget(game, suit, column)) return false
    game.tableau[column].pop()
    game.notice = 'Strike removed the selected card.'
  } else if (suit === 'int') {
    const longest = game.tableau.reduce((leftmost, stack) => stack.length > leftmost.length ? stack : leftmost)
    const destination = game.tableau.findIndex(stack => !stack.length)
    const count = Math.floor(longest.length / 2)
    game.tableau[destination] = longest.splice(-count)
    game.notice = `Tactical moved ${count} card${count === 1 ? '' : 's'} to column ${destination + 1}.`
  } else {
    for (const stack of game.tableau) {
      const card = nextCoveredCard(stack)
      if (card) card.revealed = true
    }
    game.notice = 'Perceive revealed the next hidden card in each stack.'
  }
  game.energy[suit] -= game.powerCosts[suit]
  settle(game)
  return true
}

export function equip(game: Game, suit: Suit) {
  if (suit === 'dex' || !canPower(game, 'dex')) return false
  const cost = game.powerCosts.dex
  game.energy.dex -= cost
  game.energy[suit]++
  game.notice = `Equip spent ${cost} Dex to add 1 ${powers[suit].label} energy.`
  settle(game)
  return true
}

export function advance(game: Game, random = Math.random) {
  if (game.phase !== 'clear') return false
  const stage = game.stage + 1
  Object.assign(game, deal(stage, random), { stage, hp: Math.min(maxHp, game.hp + 3) })
  return true
}
