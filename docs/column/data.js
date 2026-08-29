// Units, personas and constants for GRANDIOSE — THE COLUMN.
//
// Everything here is data. No logic, no DOM. The engine imports it; the tests
// import it; the interface will import it. If a number is wrong, it is wrong in
// exactly one place.
//
// CANON. Every unit is from Grandiose: The Rise to Power (S. T. Chalk, 2026).
// `q` is the line shown with the unit and `qv: 1` means it is the author's,
// lifted from the manuscript and trimmed only at its ends or re-cased at its
// start. `nv: 1` means the UNIT was invented for the game even where its line is
// his -- two different questions, and the interface must not blur them. The
// manuscript is NOT in this repository and must not be: the repository is public
// and the novel is his.
//
// ALL TWELVE LINES ARE NOW THE AUTHOR'S, checked word by word against the
// manuscript. Seven of them were marked "written for the game" and were not --
// four were verbatim and had simply never been checked, and three were his words
// stitched, which have been restored to the sentences they came from. The
// failure ran BOTH ways: an early draft gave Varan a line that reads exactly
// like the book and appears in it zero times, and the correction to that
// over-corrected into telling him five of his own sentences were mine.

export const BUILD = 'column-v18';

/* ------------------------------------------------------------- the battlefield */
// Portrait. The armies start at opposite ends of a field deeper than it is wide,
// because that is the shape of the phone this is played on. Distances are in
// field units, not pixels — the renderer scales them and the engine never knows
// what a pixel is.
export const FIELD = { w: 100, d: 140 };

// One tick is a tenth of a second of game time. The resolver is fixed-timestep
// and seeded, so a battle is a pure function of (armyA, armyB, seed) and can be
// replayed exactly. That is the only reason any figure below can be asserted.
export const TICK = 0.1;
export const MAX_TICKS = 3000;          // 5 minutes; a battle this long is a draw

/* -------------------------------------------------------------------- the units */
// THREE WEIGHT CLASSES, per Sam. A card deploys bodies according to its class
// and nothing else, so battlefield population is bounded by construction rather
// than by tuning:
//
//   heavy  1 body    medium  2 bodies    light  3 bodies
//
// `count` is DERIVED from the class and is not a field a card may set, because
// the previous roster let a Crawler Swarm deploy ten and that one number put 171
// bodies on a phone screen by the end of a match.
//
// THESE ARE NOT EQUAL-POWER CARDS, deliberately. The earlier roster tried to put
// every card near the same count^2 x hp x dps; Sam's direction rejects that.
// A heavy is individually formidable, a light is weak per body and earns its
// place through numbers, and the classes are meant to be strategically
// different rather than mathematically identical. Balance comes from counters:
//
//   light swarms overwhelm slow single-target attackers
//   AOE punishes light, because three bodies stand close enough to share a blast
//   heavy hp absorbs AOE efficiently, because a splash hits one body not three
//   damage-over-time ignores armour, so it is what punishes a heavy
//   fast units bypass a frontline and reach ranged and support
//
// Good composition should have several of those running at once, which is why
// the go/no-go now measures MIXED armies rather than single-card ones.
//
// Fields (count is derived; w is the class):
//
//   w      'heavy' | 'medium' | 'light' — decides how many bodies deploy
//   hp     health of each body
//   dmg    damage per attack, before the defender's armour
//   rate   ticks between attacks
//   rng    attack range in field units. <= 4 is melee for targeting purposes
//   spd    field units per tick
//   arm    flat damage subtracted from every incoming hit, to a floor of 1
//   splash radius of area damage around the target
//   tgt    'near' | 'big' | 'back'  — who it shoots, among what it can reach
//   move   'line' (default) | 'seek'. A LINE card advances with the rest of its
//          army and holds formation; a SEEK card leaves the line and crosses for
//          whatever `tgt` names. Three cards seek, and the book says so of each:
//          the Karkinos "hauled itself over the wall's crown", the crawlers move
//          "up the walls and along the ceiling, moving in all planes at once",
//          and the fireship's whole purpose is to reach the enemy's centre.
//          One global movement rule was tried and it deleted those three units:
//          the counter graph went 3 of 3 to 0 of 3 and all three fell out of
//          every cycle, because their identity is WHERE THEY WALK.
//   defl   fraction of RANGED damage refused. The Kraken rule: a shield tuned
//          for weapons fire that slow things pass straight through
//   dot    damage per tick applied for `dotT` ticks after a hit
//   aura   damage per tick to every enemy within `auraR`, needing no attack
//   boom   { r, d } detonation on death
//
// These numbers are a FIRST GUESS, chosen to make the counter-graph expressible
// rather than balanced. test/matchup.mjs exists to tell us they are wrong.
export const WEIGHT = { heavy: 1, medium: 2, light: 3 };

/* ------------------------------------------------------------------ upgrades */
// Sam's design point 3: reinforcement cards AND upgrade cards. A reinforcement
// pick adds a card, and therefore bodies. An UPGRADE pick adds nothing to the
// field and makes what is already standing on it stronger.
//
// That is the answer to the crowd. A match currently ends with about 107 bodies
// on a 393pt-wide screen, and no amount of drawing fixes a field that dense; the
// upgrade pick is the only lever that reduces it without touching the round
// structure or the square law, because a pick spent on an upgrade is a pick not
// spent on three more crawlers.
//
// An upgrade is offered ONLY for a unit type the army already fields. An upgrade
// to nothing is a wasted pick and the player cannot be asked to guess whether it
// applies. Each level multiplies health and every damage channel; it never
// touches `count`, armour, range or speed, so an upgrade makes a card more of
// itself and cannot turn it into a different card.
//
// These three numbers are a first guess. test/match.mjs measures what they do to
// army size and to how often the draft decides the battle.
export const UPGRADE = {
  step: 0.35,     // +35% health and damage per level
  max: 3,         // levels above base
  chance: 0.5     // how often an eligible offered card arrives as an upgrade
};

export const UNITS = [
  // ---- heavy: one body, individually formidable -------------------------
  { id: 'walker', n: 'Walker', w: 'heavy',
    hp: 820, dmg: 75, rate: 26, rng: 20, spd: 0.35, arm: 4, splash: 8, tgt: 'near',
    q: 'The walker was four stories of articulated war machine.', qv: 1 },

  { id: 'brute', n: 'Brute', w: 'heavy',
    hp: 980, dmg: 70, rate: 18, rng: 4, spd: 0.62, arm: 3, tgt: 'near',
    q: 'It went through a Union squad the way weather goes through paper.', qv: 1 },

  { id: 'ultra', n: 'Ultra Armor', w: 'heavy',
    hp: 780, dmg: 72, rate: 11, rng: 5, spd: 0.62, arm: 12, tgt: 'near',
    q: 'Every round the survivors put on them skidded off the black plate like rain off glass.', qv: 1 },

  { id: 'amabie', n: 'Amabie', w: 'heavy',
    hp: 300, dmg: 130, rate: 32, rng: 62, spd: 0.28, splash: 16, tgt: 'big',
    q: 'A walking artillery piece the size of a customs house.', qv: 1 },

  // ---- medium: two bodies, specialised roles -----------------------------
  // SIX legs. The manuscript says both -- "waiting on its four vast legs" of one
  // machine, Samuel's, and "crab-bodied urban mechs ... on six legs apiece,
  // railguns folded along their backs" of the squads. A previous session read
  // the first, called six an invention, and wrote that down; the card is the
  // TYPE, so it is six. It breaches by climbing -- over the wall rather than
  // through the gate -- which is why it seeks.
  { id: 'karkinos', n: 'Karkinos', w: 'medium',
    hp: 380, dmg: 40, rate: 10, rng: 6, spd: 1.6, tgt: 'back', move: 'seek',
    q: 'Front legs punching anchor-deep into the plate and stone, rear legs following.', qv: 1 },

  // INVENTED. "Deflector" appears in the manuscript zero times -- the name and
  // the unit are written for the game. Only its line is the author's, and that
  // line is the Kraken's shield, which is where the property comes from.
  { id: 'deflector', n: 'Deflector', w: 'medium',
    hp: 420, dmg: 26, rate: 12, rng: 4, spd: 0.72, defl: 0.85, tgt: 'near',
    q: 'Its shields are tuned for weapons fire. Pods fall through.', qv: 1, nv: 1 },

  { id: 'volt', n: 'Volt Battery', w: 'medium',
    hp: 330, dmg: 0, rate: 999, rng: 0, spd: 0.78, aura: 1.5, auraR: 18, tgt: 'near',
    q: 'The volt round’s enormous older sibling, charged projectiles that didn’t need to hit to hurt.', qv: 1 },

  // Damage over time is not reduced by armour, which is what makes this the
  // answer to a heavy rather than one more ranged attacker.
  { id: 'acid', n: 'Acid Thrower', w: 'medium',
    hp: 230, dmg: 12, rate: 14, rng: 30, spd: 0.65, dot: 6, dotT: 60, tgt: 'big',
    q: 'The stuff clung to shields and ate through, sheeted across hulls and kept eating.', qv: 1 },

  // ---- light: three bodies, strong in numbers, soft to AOE ---------------
  { id: 'line', n: 'Line Infantry', w: 'light',
    hp: 215, dmg: 33, rate: 8, rng: 3, spd: 1.05, tgt: 'near',
    q: 'You’re soldiers of the Union. The fleet has not fired. Until it fires, you check your sectors.', qv: 1 },

  { id: 'swarm', n: 'Crawler Swarm', w: 'light',
    hp: 155, dmg: 27, rate: 4, rng: 2, spd: 2.1, tgt: 'big', move: 'seek',
    q: 'They hit the crowded street the way current hits a shoal.', qv: 1 },

  { id: 'neurite', n: 'Neurite', w: 'light',
    hp: 180, dmg: 31, rate: 9, rng: 32, spd: 0.85, tgt: 'near',
    q: 'They aren’t animals. Whatever is behind their eyes was aiming.', qv: 1 },

  { id: 'fireship', n: 'Fireship', w: 'light',
    hp: 175, dmg: 4, rate: 20, rng: 3, spd: 1.15, tgt: 'near', move: 'seek', boom: { r: 15, d: 120 },
    q: 'Set autopilot, best speed, into the swarm’s central mass.', qv: 1 }
];

/* ------------------------------------------------------------ the specials */
// THREE CARDS THE DRAFT NEVER OFFERS. One a weight class, bought at the market
// and one of each a side, and they are the answer to two problems at once:
//
//   · the economy had no sink. Income is about 102 credits a match with nothing
//     over 44 to spend it on, so credits piled up. A special costs more than one
//     market visit, which makes saving across visits a decision for the first time.
//   · the roster had no growth path that did not cost the counter graph. Adding
//     cards to the DRAFT pool would re-derive all of it -- 86% of pairings
//     decisive, 126 cycles, every unit the best answer to something. Shop-only
//     cards touch none of it, because a single-type pairing never sees them.
//
// `sp` marks a card as special: `offer()` refuses to deal it, the market sells
// it, and `count` is its own rather than its class's, because a special is
// allowed to break the rule that keeps the DRAFT honest.
//
// EACH ONE MUST STILL LOSE TO SOMETHING. A special that answers everything is
// not a prize, it is the end of the game.
//
// THE NUMBERS ARE MEASURED, not chosen. The question a special has to pass is
// the one a player actually faces at the market: this, or the ordinary cards the
// same credits would buy, added to the column I already have? At the first guess
// all three LOST that comparison -- 19-28% -- so they were worth having and
// strictly worse value, which is a trap rather than a prize. Scaled until each
// sits near an even choice: the Kraken and the Purifier needed half again, and
// the Adarnas needed three times, because six light bodies against three cards
// is the square law and more bodies could not fix it -- twenty-four of them
// still lost.
//
// All three are the author's, checked against the manuscript by name and by
// description. "Lancer" was checked too and is a person.
export const SPECIALS = [
  // "limbs, each one longer than a cruiser, moving with a fluid, boneless
  // wrongness" -- it took a battleship "and squeezed". Its shields are the
  // Deflector's rule, so the real thing outranking the copy is right. Answered
  // by acid, because damage over time ignores armour and a shield tuned for
  // weapons fire does not stop it.
  { id: 'kraken', n: 'Kraken', w: 'heavy', sp: 'heavy', cost: 90, count: 1,
    hp: 2400, dmg: 285, rate: 22, rng: 5, spd: 0.5, arm: 6, defl: 0.6, tgt: 'near',
    q: 'The volleys broke against its shields and armor like weather.', qv: 1 },

  // "They burned the orbitals, then the cities, then the croplands, and then
  // they stayed in orbit an extra day to burn the forests." Area denial as a
  // doctrine: long reach, a wide blast, and ground that keeps burning. Answered
  // by anything that crosses the field, because it is slow and thin.
  { id: 'purifier', n: 'Purifier', w: 'medium', sp: 'medium', cost: 75, count: 1,
    hp: 510, dmg: 135, rate: 30, rng: 48, spd: 0.3, splash: 20, dot: 4, dotT: 40, tgt: 'big',
    q: 'Their doctrine held that the life itself was the contamination.', qv: 1 },

  // "The Adarnas dropped through smoke the whole way down ... a platoon at his
  // back." A platoon delivered at the line of contact rather than marched to it,
  // which is what `drop` means. Answered by splash: six bodies standing together
  // is exactly what area damage is for.
  { id: 'adarnas', n: 'Adarnas', w: 'light', sp: 'light', cost: 70, count: 6, drop: 1,
    hp: 570, dmg: 90, rate: 7, rng: 3, spd: 1.2, tgt: 'near',
    q: 'The Adarnas dropped through smoke the whole way down.', qv: 1 }
];

UNITS.push(...SPECIALS);

// Derived for a draft card, its own for a special.
UNITS.forEach(u => { if (!u.sp) u.count = WEIGHT[u.w]; });

// The draft pool: everything the offer may deal. One place, so a special can
// never arrive as a free pick.
export const DRAFT = UNITS.filter(u => !u.sp);

export const BY_ID = Object.fromEntries(UNITS.map(u => [u.id, u]));

/* ------------------------------------------------------------------- the match */
// Sam's structure, taken as given:
//   five lives; three picks a round, each one a blind simultaneous commitment
//   revealed to both sides before the next; the round ends when one army is
//   wiped out; the loser drops a life, everything resets to starting positions,
//   and the loser opens the next round with one extra pick.
export const RULES = {
  lives: 5,
  picksPerRound: 3,
  loserBonusPicks: 1,
  offer: 3,             // cards shown per pick
  maxRounds: 20         // a match is 5-9 rounds; this only catches a runaway
};

/* -------------------------------------------------------------------- the market */
// Stage one of Sam's survival loop, built inside the match that already exists
// rather than as a new mode. Two rules and one screen:
//
//   · a side earns 1 for every BODY it still has standing when a round ends,
//     and the winner also takes a flat purse
//   · every third round a market opens and both sides spend
//
// THE SURVIVOR MONEY IS THE POINT, and it is his. A win with one survivor and a
// win with twenty are currently identical -- the game does not reward winning
// cleanly at all, anywhere. This is the only rule that does.
//
// Money for KILLS was proposed and cut: a side is already paid for winning, and
// paying per kill pays you for losing rounds in which you did damage, which is
// the extra-pick comeback a second time. Two sources, not three, so income is
// predictable enough for a player to plan and for a sweep to tune.
//
// THE ECONOMY IS IN THE ENGINE AND BOTH SIDES USE IT. A shop that only the
// interface knew about could not be swept, and the first question it has to
// answer is whether paying the winner turns the match into a snowball --
// alternation sits at 55% and match.mjs measures exactly that.
//
// The market sells what the draft CANNOT: a named card instead of a random
// offer, a level on a card you choose, a life, a wider offer next round. Money
// buying certainty is what makes a drafting game feel like progress; a shop
// selling +10% damage sells nothing.
//
// Every number here is a first guess.
// Credits, ₡ — the same coin as Grandiose, because it is the same universe and
// two names for one currency across two games in one book is two things to
// learn for no reason.
export const COIN = '₡';

export const SHOP = {
  every: 3,        // rounds between markets
  // BOTH sides take the purse and only the winner is paid for survivors, which
  // is Sam's balancing call. Paying the purse to the winner alone pushed
  // round-to-round alternation from 55% to 62% against a 65% ceiling: winning
  // bought the money that bought the next win. The flat half is now income and
  // the survivor half is the reward, so a bad round still leaves you able to buy.
  purse: 10,       // to BOTH sides at a round's end
  // PRICED AGAINST THE INCOME, and re-priced when the income changed. Paying the
  // purse to both sides took total payout across a match from ~125 to ~218, so
  // the same prices were suddenly half price: army sizes went from 38 to 44
  // bodies a side and the field got denser, which is the one thing the counters
  // cannot afford. Multiplied by the change in income rather than guessed.
  card: 21,        // any one card in the roster, chosen
  upgrade: 18,     // one level on a card you name
  life: 44,
  offer: 14        // next round you are offered four cards instead of three
};

/* ------------------------------------------------- kit, sabotage and orders */
// Three more things the market sells, and they are three different SHAPES of
// decision rather than three more ways to be stronger:
//
//   EQUIPMENT is permanent and army-wide. It attaches to a ROLE rather than to a
//   card, so it rewards a column that has leaned one way -- and every target is
//   derived from stats the resolver already reads, so no card has to be told
//   what it is.
//
//   SABOTAGE is the only thing you can buy that makes THEM weaker. Its value
//   depends on their army rather than yours, which means it is the one purchase
//   that makes you look at the other half of the field -- and you can, because
//   every counter is named and drawn.
//
//   AN ORDER lasts one round. It is what a spell would have been: Sam asked
//   about spells and the answer was no, because a cast during a battle is either
//   a timed input -- which ends the battle being a pure function of two armies
//   and a seed, and with it every figure in this project -- or it is
//   pre-committed, in which case it is this.
// PRICED ON WHAT THEY MEASURED AS WORTH, against the ordinary cards the same
// credits buy, added to the same column. And with one asymmetry stated rather
// than assumed: KIT CARRIES BETWEEN MATCHES AND CARDS DO NOT, because the army
// is redrafted every match. A single-match measurement is therefore a floor for
// a piece of kit and exact for an order, which lasts a round.
// THESE LAST THE MATCH, NOT THE RUN, and the copy said otherwise in three places
// for as long as kit has existed. Kit is a token in the army list (`eq:plate`),
// and a run redrafts the army from nothing every match -- `playRun` carries
// credits, lives and boosters forward and nothing else, which is what the run
// screen itself tells the player. So the button in the shop was promising
// something the engine does not do, on a purchase the player pays 30 for before
// they can find out. The price is unaffected: it was measured over a single
// match, which makes it exact here rather than the floor the pricing note called
// it. WHETHER kit should carry is a live design question and Sam's; that it must
// not SAY it carries while it does not is neither.
export const KIT = [
  { id: 'plate',  n: 'Ablative plate', cost: 30,
    d: 'Every heavy of yours takes 10 less from each hit, for the rest of this match.' },
  { id: 'sights', n: 'Range-finders',  cost: 30,
    d: 'Everything of yours that shoots past 6 reaches 8 further, for the rest of this match.' },
  { id: 'drill',  n: 'Field drill',    cost: 30,
    d: 'Every light body of yours carries 70 more health, for the rest of this match.' }
];
// `left` is the FRACTION OF HEALTH THE TARGET KEEPS, not the fraction taken off,
// and it is 0.4 rather than 0.5. It was called `half` while holding 0.4 -- nothing
// read the name so nothing was wrong on screen (the interface derives the figure
// it prints from this number), but a constant whose name disagrees with its value
// is a trap laid for whoever tunes it next.
export const SABOTAGE = { cost: 26, left: 0.4 };
export const ORDERS = [
  { id: 'march',  n: 'Forced march',  cost: 11,
    d: 'Next round only: your column advances at double pace and your seekers run harder.' },
  { id: 'volley', n: 'Sustained fire', cost: 20,
    d: 'Next round only: everything of yours that shoots past 6 fires a quarter faster.' }
];
export const BY_KIT = Object.fromEntries(KIT.map(k => [k.id, k]));
export const BY_ORDER = Object.fromEntries(ORDERS.map(k => [k.id, k]));

/* ---------------------------------------------------------------------- a run */
// Stage two. A run is match after match: the army is redrafted every time,
// because the draft is the game and a carried army makes match two a formality,
// and the CREDITS carry, because saving for something is a decision.
//
// The opponent ramps with every match survived — a head start in credits, and an
// extra pick a round every few matches. It is stated on the screen before each
// match rather than hidden, so a loss is legible.
export const RUN = {
  ramp: 18,        // credits the opponent starts with, per match already survived
  pickEvery: 3,    // matches between the opponent gaining an extra pick each round
  order: ['vex', 'hale', 'harlow', 'leader', 'varan'],
  // LIVES CARRY AND ONLY THE MARKET SELLS THEM. Sam's rule, and it is what turns
  // credits into a real decision: every purse is a choice between a stronger
  // column now and staying alive to draft another one. The OPPONENT resets to
  // full every match, because they are a new opponent -- you are the one running
  // the gauntlet, and a wounded opponent carried forward would make every match
  // after the first a formality.
  carryLives: true,
  offered: 3       // boosters shown after a match survived
};

/* ------------------------------------------------------------------ boosters */
// Stage three. After a match survived you choose one of three; the opponent
// takes one at random. Same count, and the asymmetry is the CHOICE.
//
// RE-CUT TWICE, and the second cut is the one that mattered.
//
// The first pool was economy -- more credits, cheaper shelves, double salvage --
// and only "a fourth pick" moved a run at all. Re-measured after the specials,
// the kit and the rewritten shopper had tripled the economy, it came out the
// same. So the pool went draft-shaped: five boosters that changed what you were
// offered, what a pick was worth, or how many you got.
//
// THREE OF THOSE FIVE THEN MEASURED AS NOTHING, once the measurement itself was
// fixed. The arm had been "prefer X, take something ELSE when X is not offered",
// so every arm was collecting real boosters and beat a do-nothing control
// whatever X was -- a booster id the engine does not implement scored +0.58 in
// it. Isolated properly, over 300 runs an arm: Veterans +0.92 matches, a fourth
// pick +0.44, and Standing muster, Requisition and Wider muster at +0.09, +0.09
// and +0.05, none of them separable from noise.
//
// WHAT SURVIVED SAYS WHAT THE GAME IS. The two that worked change how many picks
// you get and what a pick is worth. The three that did not change what you are
// OFFERED and what the market CHARGES -- and being shown five cards instead of
// three is worth a twentieth of a match, which says the third card was never the
// binding constraint. Economy has now measured dead on this axis three separate
// times and the offer once, so neither is represented here any more.
//
// THE REPLACEMENTS WERE MEASURED THE SAME WAY AND THREE MORE DIED. Reserves (two
// picks to open a match) +0.06 at 1.2 sigma. Field surgeons (a life back each
// match) +0.06 at 1.2 sigma. Attrition (the opponent's ramp halved, designed
// deliberately to GROW with the run) +0.06 at 1.1 sigma. Eight boosters have now
// been measured against a do-nothing control across three separate designs, and
// they line up in one table:
//
//   Veterans        every card, from the moment you take it        +0.86
//   A fourth pick   +1 pick a round, about +7 a match              +0.42
//   The Vanguard    +1 pick a round LOST, about +3.5 a match       +0.13
//   the other five  offer-shaped, economy-shaped, or a fixed few   +0.05 to +0.09
//
// THE CONSTRAINT IS THE RUN, NOT THE POOL. A run survives 1.44 matches from this
// seat, and the first booster only arrives after match one -- so a booster gets
// one or two matches to matter. Anything that scales with run length is worth
// nothing because there is no run length; that is why Attrition, built for
// exactly that, measured the same as the fillers it replaced. Only a booster
// that acts at once and on EVERYTHING is worth much, and Veterans is the only
// one of those anybody has thought of.
//
// SO: THREE, and not a fourth invented to round the number up. Three offered
// after each match means the whole pool is on screen and the decision is the
// ORDER -- Veterans first compounds hardest, the fourth pick pays sooner -- which
// is a smaller decision than intended and an honest one. Whether the booster slot
// should carry more than that is a question about how long a run is, and that is
// Sam's.
//
// The Vanguard is the novel's own argument as a rule. The Leader spends eleven
// thousand crew to take the Dominion's undefended core and tells the council the
// sacrifice purchased the war; the extra pick for losing a round already says
// that, and this says it twice.
export const BOOSTS = [
  { id: 'extra',    n: 'A fourth pick', d: 'Four picks a round instead of three.' },
  { id: 'veteran',  n: 'Veterans',      d: 'Every card you draft arrives already upgraded once.' },
  { id: 'vanguard', n: 'The Vanguard',  d: 'A round you lose buys two picks, not one.' }
];
export const BY_BOOST = Object.fromEntries(BOOSTS.map(b => [b.id, b]));

/* ----------------------------------------------------------------- the personas */
// The personality IS the drafting policy. Voice lines can come later; a persona
// that only talks is decoration. Each `pick` receives the offered cards and the
// board so far and returns an index.
//
// Named for the book's own auditors and spenders. The descriptions are written
// for the game, not quoted, except where marked.
export const PERSONAS = {
  varan: {
    n: 'Varan',
    d: 'Drafts to deny. Takes what you need rather than what he needs — the auditor reading for the shape of what is not there.'
  },
  harlow: {
    n: 'Harlow',
    d: 'Drafts to keep. Durable, refuses trades, nothing dies that did not have to.'
  },
  hale: {
    n: 'Hale',
    d: 'Drafts to schedule. Front-loads, presses tempo, closes early.'
  },
  vex: {
    n: 'Vex',
    d: 'Drafts to profit. Takes the biggest number on the card, every time.'
  },
  leader: {
    n: 'The Leader',
    d: 'Drafts to spend. Concedes early rounds deliberately to buy the late one.'
  }
};
