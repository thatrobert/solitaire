export const suits = ['str', 'int', 'wis', 'dex', 'con', 'cha'] as const
export type Suit = typeof suits[number]
export const maxHp = 10
export const columns = 7
export const powers = {
  str: { label: 'Str', name: 'Strike', detail: 'Remove an exposed card and gain 1 energy of its suit.' },
  int: { label: 'Int', name: 'Cleave', detail: 'Move the top half of the leftmost longest stack to the first empty column. Round down for odd stacks.' },
  wis: { label: 'Wis', name: 'Perceive', detail: 'Reveal the nearest hidden card in each stack that has one.' },
  dex: { label: 'Dex', name: 'Equip', detail: 'Give another suit 1 energy.' },
  con: { label: 'Con', name: 'Recover', detail: 'Restore 1 HP.' },
  cha: { label: 'Cha', name: 'Dazzle', detail: 'Block the next draw’s stack addition in Ancient Ruins or damage in a guardian encounter.' },
} as const

type Encounter = {
  name: string
  art: string
  rows: number
  filledColumns: number
  damage: number
  door?: boolean
  layout?: 'ruins'
}
export const encounters: readonly Encounter[] = [
  { name: 'Ancient Ruins', art: 'ancient-ruins', rows: 2, filledColumns: 7, damage: 0, layout: 'ruins' },
  { name: 'The Brass Sentinel', art: 'sentinel', rows: 4, filledColumns: 5, damage: 1 },
  { name: 'The Tide Keeper', art: 'keeper', rows: 5, filledColumns: 5, damage: 2 },
  { name: 'The Eclipse Regent', art: 'regent', rows: 6, filledColumns: 5, damage: 2 },
  { name: 'The Obsidian Wyrm', art: 'wyrm', rows: 7, filledColumns: 5, damage: 3 },
]

export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
export type CardModifier = 'shield' | 'drop' | 'bomb'
export type Joker = 'fool' | 'door'
type CardBase = { id: string; revealed: boolean }
type SuitedCard = CardBase & { suit: Suit; rank: Rank; modifier?: CardModifier; joker?: never }
export type Card = SuitedCard | (CardBase & { joker: 'fool'; modifier?: never })
  | (CardBase & { joker: 'door'; opened?: boolean; modifier?: never })
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
  stock: SuitedCard[]
  scenarioDeck: SuitedCard[]
  tableau: Card[][]
  active: Card
  spent: Card[]
  phase: 'battle' | 'door' | 'clear' | 'victory' | 'defeat'
  notice: string
}

export function nextRank(rank: Rank): Rank {
  return rank === 9 ? 1 : (rank + 1) as Rank
}

export function rankText(rank: Rank) {
  return rank === 1 ? '1/10' : String(rank)
}

function ranksMatch(active: Card, candidate: Card) {
  if (active.joker || candidate.joker) return true
  return nextRank(active.rank) === candidate.rank || nextRank(candidate.rank) === active.rank
}

export function makeDeck(): SuitedCard[] {
  return suits.flatMap(suit => Array.from({ length: 9 }, (_, index) => ({
    id: `${suit}-${index + 1}`, suit, rank: (index + 1) as Rank, revealed: false,
  })))
}

function shuffle(deck: SuitedCard[], random: () => number) {
  for (let n = deck.length - 1; n > 0; n--) {
    const index = Math.floor(random() * (n + 1))
    const card = deck[n]
    deck[n] = deck[index]
    deck[index] = card
  }
  return deck
}

function deal(stage: number, random: () => number) {
  const scenarioDeck = shuffle(makeDeck().map(card => ({ ...card, id: `scenario-${card.id}` })), random)
  const { rows, filledColumns, door, layout } = encounters[stage]
  const firstFilledColumn = (columns - filledColumns) / 2
  const doorIndex = layout === 'ruins'
    ? Math.floor(random() * filledColumns) * rows
    : door && stage + 1 < encounters.length ? Math.floor(random() * rows * filledColumns) : -1
  const foolChance = 10
  const shieldChance = 20
  const dropChance = 20
  const tableau = Array.from({ length: columns }, (_, column) => {
    const filledColumn = column - firstFilledColumn
    if (filledColumn < 0 || filledColumn >= filledColumns) return []
    return scenarioDeck.splice(0, rows).map((card, depth): Card => {
      if (filledColumn * rows + depth === doorIndex) return { id: 'door', joker: 'door', revealed: false }
      if (layout === 'ruins') {
        if (depth === 0) card.modifier = 'bomb'
        return card
      }
      const roll = random() * 100
      if (roll < foolChance) return { id: `fool-${card.id}`, joker: 'fool', revealed: false }
      if (roll < foolChance + shieldChance) card.modifier = 'shield'
      else if (roll < foolChance + shieldChance + dropChance) card.modifier = 'drop'
      return card
    })
  })
  const stock = shuffle(makeDeck(), random)
  const firstMatch = stock.findIndex(card => tableau.some(stack =>
    stack.length > 0 && ranksMatch(card, stack[stack.length - 1]),
  ))
  const [active] = stock.splice(firstMatch < 0 ? 0 : firstMatch, 1)
  const energy = { str: 0, int: 0, wis: 0, dex: 0, con: 0, cha: 0 }
  energy[active.suit]++
  return {
    tableau,
    active,
    stock,
    scenarioDeck,
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
  return game.phase === 'battle' && ranksMatch(game.active, card)
}

function hasCleaveMove(game: Game) {
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
    case 'int': return hasCleaveMove(game)
    case 'wis': return game.tableau.some(nextCoveredCard)
    case 'con': return game.hp < maxHp
    case 'dex': return true
    case 'cha': return !game.dazzled && game.scenarioDeck.length > 0 && drawPile(game).length > 0
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
  } else if (game.phase === 'door') {
    return
  } else if (game.tableau.every(stack => !stack.length || (stack.length === 1 && stack[0].joker === 'door' && stack[0].opened))) {
    game.phase = game.stage === encounters.length - 1 ? 'victory' : 'clear'
    game.notice = 'Every column cleared.'
  } else if (!drawPile(game).length && !(hasStrikeTarget(game) && game.energy.str + trades >= game.powerCosts.str) &&
    !(hasCleaveMove(game) && game.energy.int + trades >= game.powerCosts.int) &&
    !game.tableau.some(stack => stack.length && canMatch(game, stack[stack.length - 1]))) {
    game.phase = 'defeat'
    game.notice = 'No stock or playable cards remain.'
  }
}

function finishTurn(game: Game) {
  const bombs = game.tableau.filter(stack => stack.at(-1)?.modifier === 'bomb').length
  if (bombs) {
    game.hp = Math.max(0, game.hp - bombs)
    game.notice += ` ${bombs === 1 ? 'Bomb' : 'Bombs'} cost ${bombs} HP.`
  }
  settle(game)
}

function playAsActive(game: Game, card: Card) {
  if (!card.joker) game.energy[card.suit]++
  game.spent.push(game.active)
  game.active = card
}

function breakShield(game: Game, card: Card) {
  if (card.modifier !== 'shield') return false
  delete card.modifier
  game.notice = 'The shield broke.'
  return true
}

export function match(game: Game, column: number) {
  const card = top(game, column)
  if (!card || !canMatch(game, card)) return false
  if (card.joker === 'door' && game.stage + 1 < encounters.length) {
    card.opened = true
    game.phase = 'door'
    game.notice = 'The Door opened.'
    return true
  }
  if (breakShield(game, card)) {
    game.spent.push(game.active)
    game.active = { ...card, id: `shield-copy-${card.id}` }
    finishTurn(game)
    return true
  }
  game.tableau[column].pop()
  if (card.joker === 'door') {
    game.notice = 'The Door opened.'
  } else {
    playAsActive(game, card)
    game.notice = card.joker === 'fool' ? 'The Fool can match any card.' : 'Matched.'
  }
  game.streak++
  game.best = Math.max(game.best, game.streak)
  if (card.modifier === 'drop') {
    delete card.modifier
    game.hp = Math.max(0, game.hp - 1)
    game.notice = 'Matched. Blood drop cost 1 HP.'
  } else if (card.modifier === 'bomb') {
    delete card.modifier
  }
  const goldEarned = Math.max(0, game.streak - 5)
  if (goldEarned) {
    game.gold += goldEarned
    game.notice += ` Streak bonus: +${goldEarned} gold.`
  }
  finishTurn(game)
  return true
}

export function drawPile(game: Game) {
  return encounters[game.stage].layout === 'ruins' ? game.stock : game.scenarioDeck
}

export function draw(game: Game, random = Math.random) {
  if (game.phase !== 'battle') return false
  const card = drawPile(game).pop()
  if (!card) return false
  game.streak = 0
  const { damage, layout } = encounters[game.stage]
  const blocked = game.dazzled
  game.dazzled = false
  if (!blocked) game.hp = Math.max(0, game.hp - damage)
  playAsActive(game, card)
  if (layout === 'ruins') {
    game.notice = blocked ? 'Dazzle blocked the stack addition.' : 'Drew a card.'
    const scenarioCard = blocked ? undefined : game.scenarioDeck.pop()
    if (scenarioCard) {
      const destinations = game.tableau.map((_, column) => column).filter(column => top(game, column)?.joker !== 'door')
      const column = destinations[Math.floor(random() * destinations.length)]
      game.tableau[column].push(scenarioCard)
      game.energy[scenarioCard.suit]++
      game.notice += ` Added a scenario card to column ${column + 1}.`
    }
  } else {
    game.notice = blocked ? 'Dazzle blocked the damage.' : `The guardian hit for ${damage} HP.`
  }
  finishTurn(game)
  return true
}

export function cast(game: Game, suit: Suit, column?: number) {
  if (!canPower(game, suit) || suit === 'dex') return false
  if (suit === 'con') {
    game.hp++
    game.notice = 'Recover restored 1 HP.'
  } else if (suit === 'cha') {
    game.dazzled = true
    game.notice = encounters[game.stage].layout === 'ruins'
      ? 'Dazzle will block the stack addition on your next draw.'
      : 'Dazzle will block damage on your next draw.'
  } else if (suit === 'str') {
    if (column === undefined) return false
    const card = top(game, column)
    if (!card) return false
    if (!breakShield(game, card)) {
      game.tableau[column].pop()
      if (!card.joker) game.energy[card.suit]++
      game.notice = 'Strike removed the selected card.'
    }
  } else if (suit === 'int') {
    const longest = game.tableau.reduce((leftmost, stack) => stack.length > leftmost.length ? stack : leftmost)
    const destination = game.tableau.findIndex(stack => !stack.length)
    const count = Math.floor(longest.length / 2)
    game.tableau[destination] = longest.splice(-count)
    game.notice = `Cleave moved ${count} card${count === 1 ? '' : 's'} to column ${destination + 1}.`
  } else {
    for (const stack of game.tableau) {
      const card = nextCoveredCard(stack)
      if (card) card.revealed = true
    }
    game.notice = 'Perceive revealed the next hidden card in each stack.'
  }
  game.energy[suit] -= game.powerCosts[suit]
  finishTurn(game)
  return true
}

export function equip(game: Game, suit: Suit) {
  if (suit === 'dex' || !canPower(game, 'dex')) return false
  const cost = game.powerCosts.dex
  game.energy.dex -= cost
  game.energy[suit]++
  game.notice = `Equip spent ${cost} Dex to add 1 ${powers[suit].label} energy.`
  finishTurn(game)
  return true
}

export function advance(game: Game, random = Math.random) {
  if (game.phase !== 'clear' && game.phase !== 'door') return false
  const stage = game.stage + 1
  if (stage >= encounters.length) return false
  const hp = game.phase === 'clear' ? Math.min(maxHp, game.hp + 3) : game.hp
  Object.assign(game, deal(stage, random), { stage, hp })
  return true
}

export function stayInEncounter(game: Game) {
  if (game.phase !== 'door') return false
  game.phase = 'battle'
  game.notice = 'You stayed in the encounter.'
  settle(game)
  return true
}
