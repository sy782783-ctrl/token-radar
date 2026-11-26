# token-radar
[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/sy782783-ctrl/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/sy782783-ctrl/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

## Token Launch Radar

A radar for token launches that have not happened yet: every pre-token protocol in a sealed
DefiLlama snapshot, ranked by what its token would be worth if it launched today, each with a
concrete farm plan. Built for make.fun's "Build the best token launch radar" bounty
(token-radar-01, $1,325 USDC).

## Run it

```sh
node main.ts --input <dir-or-file-with-snapshot.json>
```

Node 22.18+ (the snapshot is mounted at `/input` in the grader; locally pass `--input`).
The run writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` to the
output directory (`/output`, or `MAKEFUN_OUTPUT_DIR` outside the grader). It is deterministic:
two runs over the same snapshot write identical bytes.

## The board

- **Coverage.** All 40 protocols on the snapshot's watchlist are ranked, plus the 160 largest
  rankable pre-token protocols below the watchlist's $50M floor ("EARLY" rows): 200 rows.
  A protocol counts as pre-token when its record shows no market cap, no CoinGecko id and no
  ticker. Exchanges, versioned pools of other protocols, and wrapped/staked/bridged products
  are never ranked as launches of their own.
- **Separation.** Protocols whose token already trades are never mixed into the ranking. They
  form the peer set (119 protocols with a positive recorded market cap, exchanges excluded)
  shown on the dashboard's Live peers tab.

## The value model (radar-2)

```
implied value = TVL x peer multiple x growth factor x maturity factor
```

- **Peer multiple.** For every launched peer, market cap / TVL. A category with at least 5
  peers is priced at its own median (Dexs 0.342x, Lending 0.132x, RWA 0.275x, ...); thinner
  categories fall back to the global median, 0.246x across 119 peers. Multiples are clamped to
  [0.05x, 2.5x]. The median, not the mean, so one runaway token cannot reprice a category.
- **Growth factor.** `1 + clamp(7d TVL change, -60%, +120%) x 0.4`.
- **Maturity factor.** `0.7 + min(age in days, 1095) / 1095 x 0.3`; unknown ages count as
  365 days. A protocol that has run tokenless for years is a likelier, sturdier launch.
- One function scores every row from its record alone; no name is special-cased. Factors are
  rounded to 4 places before being applied, so the dashboard's detail view recomputes any
  row's board figure to the dollar.

## Farm plans

Each row carries a seven-step plan generated from its own record: the two money steps follow
its category (supply-and-borrow for lending, liquidity-and-swaps for a DEX, two-way crossings
for a bridge), position size follows its TVL tier ($50-$250), the weekly cadence is priced for
its chain, and the holding period follows its age. Every step states its cost and its time.

## Dashboard

`dashboard/` is a static page (no framework, no network) reading `data.js` written by the same
run: a sortable, filterable board (search, category, chain, watchlist/early tier), a detail
view per protocol with the full model breakdown, the live peer set, and a methodology page
stating the formula, the constants and the per-category multiples.

## Layout

- `main.ts` — entrypoint the grader runs (Node 22, standard library only)
- `lib/model.ts` — the radar-2 model: peer multiples, implied value, farm plans, the board gate
- `vendor/makefun-board.ts` — make.fun's dossier library, copied unchanged from the kit
- `dashboard/` — the static dashboard
- `screenshots/` — the board, a protocol detail view, and a filtered view

## License

MIT (see `LICENSE`).

---
<sub>Entered on [make.fun](https://make.fun/?ref=nwwvrp8c&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
