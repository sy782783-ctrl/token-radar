// Token Launch Radar: a plain, offline dashboard. It reads window.RADAR (written beside dashboard/
// by main.ts) and renders four views: the ranked board (sortable, filterable), one detail view per
// protocol with the model's own arithmetic and the protocol's farm plan, the live-token peer set the
// multiples come from, and the methodology. No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var M = DATA.model;
  var bySlug = {};
  DATA.rows.forEach(function (r) { bySlug[r.slug] = r; });

  var state = { q: '', category: 'all', chain: 'all', tier: 'all', sort: 'implied', dir: -1 };

  var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd0.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) { return n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '.0'); }
  // The page recomputes a row's implied value from the factors it prints, so the page and board.json
  // are visibly the same arithmetic (the model rounds its factors to 4 places before applying them).
  function impliedOf(row) {
    return Math.max(1, Math.round(row.tvl_usd * row.base_multiple * row.growth_multiplier * row.maturity_multiplier));
  }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function header(active) {
    var totalImplied = DATA.rows.reduce(function (a, r) { return a + r.implied_value_usd; }, 0);
    var tabs = [['board', 'The board'], ['live', 'Live peers'], ['method', 'Methodology']]
      .map(function (t) {
        return '<button class="tab" data-tab="' + t[0] + '" aria-selected="' + (active === t[0] ? 'true' : 'false') + '">' + t[1] + '</button>';
      }).join('');
    return '' +
      '<div class="masthead">' +
      '<p class="eyebrow">Token Launch Radar &middot; model ' + esc(DATA.model_version) + '</p>' +
      '<h1>Pre-token protocols, ranked by what their launch would be worth</h1>' +
      '<p class="lede">Every protocol here still has <strong>no token</strong>. Each is priced the way the market prices its launched ' +
      'neighbours: its TVL times the <strong>median market-cap-to-TVL multiple of its own category</strong>, adjusted for its ' +
      'seven-day growth and for how long it has run tokenless. Snapshot: DefiLlama protocols, as of <strong>' + esc(DATA.as_of) + '</strong>. ' +
      'Click any row for the full breakdown and its farm plan.</p>' +
      '<div class="stats">' +
      '<div class="stat"><div class="k">Protocols ranked</div><div class="v num">' + DATA.board_size + '</div></div>' +
      '<div class="stat"><div class="k">Watchlist covered</div><div class="v num">' + DATA.watchlist_size + ' / ' + DATA.watchlist_size + '</div></div>' +
      '<div class="stat"><div class="k">Early, below the floor</div><div class="v num">' + DATA.early_size + '</div></div>' +
      '<div class="stat"><div class="k">Live peers priced</div><div class="v num">' + DATA.peer_count + '</div></div>' +
      '<div class="stat"><div class="k">Global peer multiple</div><div class="v num">' + fmtMult(DATA.peer_global_multiple) + 'x</div></div>' +
      '<div class="stat"><div class="k">Board implied total</div><div class="v num">' + fmtUsd(totalImplied) + '</div></div>' +
      '</div></div>' +
      '<nav class="tabs" aria-label="Views">' + tabs + '</nav>';
  }

  function footer() {
    return '<footer>Built from one sealed snapshot: the figures never leave this page and nothing is fetched. ' +
      'Implied value is a model, not a promise: it prices a protocol as if it launched at its category\'s median ' +
      'multiple today. Farm plans are checklists, not financial advice; a protocol may never issue a token.</footer>';
  }

  /* ---------------- Board view ---------------- */

  function categories() {
    var seen = {};
    DATA.rows.forEach(function (r) { if (r.category) seen[r.category] = true; });
    return Object.keys(seen).sort();
  }
  function chains() {
    var seen = {};
    DATA.rows.forEach(function (r) { r.chains.forEach(function (c) { seen[c] = true; }); });
    return Object.keys(seen).sort();
  }
  function visibleRows() {
    var q = state.q.trim().toLowerCase();
    var rows = DATA.rows.filter(function (r) {
      if (state.tier === 'watch' && !r.watchlist) return false;
      if (state.tier === 'early' && r.watchlist) return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) === -1) return false;
      if (q && (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    var key = {
      rank: function (r) { return r.rank; },
      name: function (r) { return r.name.toLowerCase(); },
      tvl: function (r) { return r.tvl_usd; },
      change: function (r) { return r.change_7d === null ? -Infinity : r.change_7d; },
      age: function (r) { return r.age_days === null ? -1 : r.age_days; },
      mult: function (r) { return r.base_multiple; },
      implied: function (r) { return r.implied_value_usd; }
    }[state.sort];
    rows.sort(function (a, b) {
      var ka = key(a), kb = key(b);
      if (ka < kb) return -state.dir;
      if (ka > kb) return state.dir;
      return a.rank - b.rank;
    });
    return rows;
  }

  function boardView() {
    var rows = visibleRows();
    var cols = [
      ['rank', '#'], ['name', 'Protocol'], ['cat', 'Category'], ['tvl', 'TVL'],
      ['change', '7d'], ['age', 'Age'], ['mult', 'Peer x'], ['implied', 'Implied value']
    ];
    var head = cols.map(function (c) {
      var sortable = ['rank', 'name', 'tvl', 'change', 'age', 'mult', 'implied'].indexOf(c[0]) !== -1;
      var arrow = state.sort === c[0] ? ' <span class="arrow">' + (state.dir === -1 ? '&#9660;' : '&#9650;') + '</span>' : '';
      return '<th class="' + (c[0] === 'name' || c[0] === 'cat' ? c[0] + ' ' : '') + (sortable ? 'sortable' : '') + '" data-sort="' + c[0] + '">' + c[1] + arrow + '</th>';
    }).join('');
    var body = rows.map(function (r) {
      var chg = r.change_7d === null ? 'n/a' : '<span class="' + (r.change_7d >= 0 ? 'pos' : 'neg') + '">' + fmtPct(r.change_7d) + '</span>';
      return '<tr data-slug="' + esc(r.slug) + '">' +
        '<td class="num">' + r.rank + '</td>' +
        '<td class="name"><span class="pname">' + esc(r.name) + '</span>' +
        '<span class="tag ' + (r.watchlist ? 'watch' : 'early') + '">' + (r.watchlist ? 'WATCHLIST' : 'EARLY') + '</span>' +
        '<br><span class="pslug">' + esc(r.slug) + ' &middot; <span class="chains">' + esc(r.chains.slice(0, 3).join(', ') || 'no chain listed') + '</span></span></td>' +
        '<td class="cat">' + esc(r.category || 'Uncategorised') + '</td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="num">' + chg + '</td>' +
        '<td class="num age">' + fmtAge(r.age_days) + '</td>' +
        '<td class="num">' + fmtMult(r.base_multiple) + 'x</td>' +
        '<td class="num implied">' + fmtUsd(r.implied_value_usd) + '</td></tr>';
    }).join('');
    var catOpts = ['<option value="all">All categories</option>'].concat(categories().map(function (c) {
      return '<option value="' + esc(c) + '"' + (state.category === c ? ' selected' : '') + '>' + esc(c) + '</option>';
    })).join('');
    var chainOpts = ['<option value="all">All chains</option>'].concat(chains().map(function (c) {
      return '<option value="' + esc(c) + '"' + (state.chain === c ? ' selected' : '') + '>' + esc(c) + '</option>';
    })).join('');
    var tierOpts = [['all', 'Whole board'], ['watch', 'Watchlist only'], ['early', 'Early only']].map(function (t) {
      return '<option value="' + t[0] + '"' + (state.tier === t[0] ? ' selected' : '') + '>' + t[1] + '</option>';
    }).join('');

    app.innerHTML = header('board') +
      '<div class="controls">' +
      '<div><label for="q">Search</label><input id="q" type="search" placeholder="Name or slug" value="' + esc(state.q) + '"></div>' +
      '<div><label for="fcat">Category</label><select id="fcat">' + catOpts + '</select></div>' +
      '<div><label for="fchain">Chain</label><select id="fchain">' + chainOpts + '</select></div>' +
      '<div><label for="ftier">Tier</label><select id="ftier">' + tierOpts + '</select></div>' +
      '<div class="count num">' + rows.length + ' of ' + DATA.board_size + ' protocols</div>' +
      '</div>' +
      (rows.length === 0
        ? '<div class="empty">No protocol matches those filters. Loosen one and the board fills again.</div>'
        : '<table class="board"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>') +
      footer();
    app.setAttribute('aria-busy', 'false');
    wireBoard();
  }

  function syncHash() {
    var p = [];
    if (state.q) p.push('q=' + encodeURIComponent(state.q));
    if (state.category !== 'all') p.push('category=' + encodeURIComponent(state.category));
    if (state.chain !== 'all') p.push('chain=' + encodeURIComponent(state.chain));
    if (state.tier !== 'all') p.push('tier=' + encodeURIComponent(state.tier));
    var h = '#/board' + (p.length ? '?' + p.join('&') : '');
    if (location.hash !== h) history.replaceState(null, '', h);
  }

  function wireBoard() {
    wireTabs();
    var q = document.getElementById('q');
    q.addEventListener('input', function () { state.q = q.value; syncHash(); refreshTable(); });
    document.getElementById('fcat').addEventListener('change', function (e) { state.category = e.target.value; syncHash(); boardView(); });
    document.getElementById('fchain').addEventListener('change', function (e) { state.chain = e.target.value; syncHash(); boardView(); });
    document.getElementById('ftier').addEventListener('change', function (e) { state.tier = e.target.value; syncHash(); boardView(); });
    app.querySelectorAll('th.sortable').forEach(function (th) {
      th.addEventListener('click', function () {
        var s = th.getAttribute('data-sort');
        if (state.sort === s) state.dir = -state.dir;
        else { state.sort = s; state.dir = s === 'name' ? 1 : -1; }
        boardView();
      });
    });
    wireRows();
  }
  function refreshTable() {
    // Search keystrokes re-render only the table body and count, keeping focus in the input.
    var rows = visibleRows();
    var tbody = app.querySelector('table.board tbody');
    var count = app.querySelector('.count');
    if (count) count.textContent = rows.length + ' of ' + DATA.board_size + ' protocols';
    if (!tbody) { boardView(); return; }
    var fresh = document.createElement('tbody');
    fresh.innerHTML = rows.map(function (r) {
      var chg = r.change_7d === null ? 'n/a' : '<span class="' + (r.change_7d >= 0 ? 'pos' : 'neg') + '">' + fmtPct(r.change_7d) + '</span>';
      return '<tr data-slug="' + esc(r.slug) + '"><td class="num">' + r.rank + '</td>' +
        '<td class="name"><span class="pname">' + esc(r.name) + '</span><span class="tag ' + (r.watchlist ? 'watch' : 'early') + '">' + (r.watchlist ? 'WATCHLIST' : 'EARLY') + '</span>' +
        '<br><span class="pslug">' + esc(r.slug) + ' &middot; <span class="chains">' + esc(r.chains.slice(0, 3).join(', ') || 'no chain listed') + '</span></span></td>' +
        '<td class="cat">' + esc(r.category || 'Uncategorised') + '</td><td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="num">' + chg + '</td><td class="num age">' + fmtAge(r.age_days) + '</td>' +
        '<td class="num">' + fmtMult(r.base_multiple) + 'x</td><td class="num implied">' + fmtUsd(r.implied_value_usd) + '</td></tr>';
    }).join('');
    tbody.replaceWith(fresh);
    wireRows();
  }
  function wireRows() {
    app.querySelectorAll('tr[data-slug]').forEach(function (tr) {
      tr.addEventListener('click', function () { location.hash = '#/protocol/' + encodeURIComponent(tr.getAttribute('data-slug')); });
    });
  }

  /* ---------------- Detail view ---------------- */

  function detailView(slug) {
    var r = bySlug[slug];
    if (!r) { boardView(); return; }
    var catMult = null;
    DATA.multiples.forEach(function (m) { if (m.category === r.category) catMult = m; });
    var multBasis = catMult
      ? 'the median of ' + catMult.peers + ' launched ' + esc(r.category) + ' peers'
      : 'the global median of ' + DATA.peer_count + ' launched peers (fewer than ' + M.min_peers + ' ' + esc(r.category || 'uncategorised') + ' peers trade)';
    var recomputed = impliedOf(r);
    var plan = r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    app.innerHTML = header('board') +
      '<a class="back" href="#/board">&larr; Back to the board</a>' +
      '<div class="detail-head"><h2>' + esc(r.name) + '</h2>' +
      '<span class="meta">' + esc(r.slug) + ' &middot; rank #' + r.rank + ' of ' + DATA.board_size + '</span>' +
      '<span class="tag ' + (r.watchlist ? 'watch' : 'early') + '">' + (r.watchlist ? 'WATCHLIST' : 'EARLY') + '</span></div>' +
      '<div class="grid">' +
      '<section class="card"><h3>The protocol</h3><table>' +
      '<tr><td class="k">Category</td><td class="v">' + esc(r.category || 'Uncategorised') + '</td></tr>' +
      '<tr><td class="k">Chains</td><td class="v">' + esc(r.chains.join(', ') || 'none listed') + '</td></tr>' +
      '<tr><td class="k">TVL</td><td class="v num">' + usd0.format(r.tvl_usd) + '</td></tr>' +
      '<tr><td class="k">TVL change, 7d</td><td class="v num">' + fmtPct(r.change_7d) + '</td></tr>' +
      '<tr><td class="k">Token</td><td class="v">none recorded: no market cap, no ticker</td></tr>' +
      '<tr><td class="k">Tracked since</td><td class="v">' + esc(r.listed_at || 'not recorded') + ' (' + fmtAge(r.age_days) + ')</td></tr>' +
      '</table></section>' +
      '<section class="card"><h3>Implied launch value</h3>' +
      '<div class="formula">implied = TVL x peer multiple x growth x maturity<br>' +
      '= ' + usd0.format(r.tvl_usd) + ' x ' + fmtMult(r.base_multiple) + ' x ' + r.growth_multiplier.toFixed(4) + ' x ' + r.maturity_multiplier.toFixed(4) + '<br>' +
      '= <strong>' + usd0.format(r.implied_value_usd) + '</strong></div>' +
      '<table>' +
      '<tr><td class="k">Peer multiple</td><td class="v num">' + fmtMult(r.base_multiple) + 'x</td></tr>' +
      '<tr><td class="k">Multiple from</td><td class="v">' + multBasis + '</td></tr>' +
      '<tr><td class="k">Growth factor</td><td class="v num">' + r.growth_multiplier.toFixed(4) + ' (7d ' + fmtPct(r.growth_pct) + ', clamped)</td></tr>' +
      '<tr><td class="k">Maturity factor</td><td class="v num">' + r.maturity_multiplier.toFixed(4) + ' (' + fmtAge(r.age_days) + ' tokenless)</td></tr>' +
      '<tr><td class="k">Page recompute</td><td class="v"><span class="check">' + (recomputed === r.implied_value_usd ? 'agrees with board.json to the dollar' : 'differs: ' + usd0.format(recomputed)) + '</span></td></tr>' +
      '</table></section>' +
      '</div>' +
      '<section class="card" style="margin-top:14px"><h3>Farm plan: ' + r.farm_steps.length + ' steps</h3><ol class="plan">' + plan + '</ol></section>' +
      footer();
    app.setAttribute('aria-busy', 'false');
    wireTabs();
    window.scrollTo(0, 0);
  }

  /* ---------------- Live peers view ---------------- */

  function liveView() {
    var body = DATA.live.map(function (p, i) {
      var ratio = p.mcap_usd !== null && p.tvl_usd > 0 ? (p.mcap_usd / p.tvl_usd) : null;
      return '<tr><td class="num">' + (i + 1) + '</td>' +
        '<td class="name"><span class="pname">' + esc(p.name) + '</span><br><span class="pslug">' + esc(p.slug) + '</span></td>' +
        '<td class="cat">' + esc(p.category || 'Uncategorised') + '</td>' +
        '<td class="num">' + fmtUsd(p.tvl_usd) + '</td>' +
        '<td class="num">' + fmtUsd(p.mcap_usd) + '</td>' +
        '<td class="num">' + (ratio === null ? 'n/a' : fmtMult(ratio) + 'x') + '</td></tr>';
    }).join('');
    app.innerHTML = header('live') +
      '<p class="lede" style="margin-bottom:14px">These protocols already have a token: the board never ranks them. They are the ' +
      '<strong>peer set</strong>: each category\'s multiple is the median of its launched members\' market-cap-to-TVL ratios ' +
      '(' + DATA.peer_count + ' peers in all, exchanges excluded). The ' + DATA.live_size + ' largest by market cap are shown.</p>' +
      '<table class="board"><thead><tr><th>#</th><th class="name">Protocol</th><th class="cat">Category</th><th>TVL</th><th>Market cap</th><th>MCap / TVL</th></tr></thead>' +
      '<tbody>' + body + '</tbody></table>' + footer();
    app.setAttribute('aria-busy', 'false');
    wireTabs();
  }

  /* ---------------- Methodology view ---------------- */

  function methodView() {
    var multRows = DATA.multiples.map(function (m) {
      return '<tr><td>' + esc(m.category) + '</td><td class="num">' + m.peers + '</td><td class="num">' + fmtMult(m.multiple) + 'x</td></tr>';
    }).join('');
    app.innerHTML = header('method') +
      '<div class="method">' +
      '<h2>The question</h2>' +
      '<p>Which protocols that still have <strong>no token</strong> would be worth the most if they launched one, and what should a ' +
      'farmer do about each? The radar answers from one sealed DefiLlama snapshot dated ' + esc(DATA.as_of) + ': ' +
      DATA.board_size + ' pre-token protocols ranked, the ' + DATA.watchlist_size + ' on the house watchlist first-classed, ' +
      DATA.early_size + ' more found below its $' + (DATA.floor_usd / 1e6) + 'M floor.</p>' +
      '<h2>Who is on the board</h2>' +
      '<ul>' +
      '<li><strong>Pre-token only:</strong> the record shows no market cap, no CoinGecko id and no ticker.</li>' +
      '<li><strong>The watchlist is the floor, never the ceiling:</strong> every watchlist protocol is ranked; below the floor, the ' +
      'largest rankable pre-token protocols join as EARLY rows. Exchanges and versioned pools of other protocols are never ranked: ' +
      'a V2 pool is someone else\'s launch, not its own.</li>' +
      '<li><strong>Wrapped, staked and bridged products are not launches:</strong> they inherit the watchlist\'s own exclusions, so a ' +
      'staked-ETH product is priced as Ethereum, never as a new token.</li>' +
      '<li><strong>Live tokens are kept apart:</strong> protocols whose token trades are the peer set, shown on the Live peers tab, ' +
      'and are never mixed into the ranking.</li>' +
      '</ul>' +
      '<h2>The value model (' + esc(DATA.model_version) + ')</h2>' +
      '<div class="formula">implied value = TVL x peer multiple x growth factor x maturity factor</div>' +
      '<ul>' +
      '<li><strong>Peer multiple:</strong> for each launched protocol, market cap divided by TVL. A category with at least ' + M.min_peers +
      ' peers is priced at its own median; thinner categories fall back to the global median, <strong>' + fmtMult(DATA.peer_global_multiple) +
      'x</strong> across ' + DATA.peer_count + ' peers. Every multiple is clamped to [' + M.mult_floor + 'x, ' + M.mult_cap + 'x] so one thin ' +
      'category cannot dominate the board. The median, not the mean: one runaway token must not reprice a whole category.</li>' +
      '<li><strong>Growth factor:</strong> 1 + clamp(7d TVL change, ' + M.growth_floor + '%, +' + M.growth_cap + '%) x ' + M.growth_weight +
      ': momentum counts, a single hot week cannot double a valuation.</li>' +
      '<li><strong>Maturity factor:</strong> ' + M.maturity_floor + ' + min(age in days, ' + M.maturity_days + ') / ' + M.maturity_days + ' x ' +
      M.maturity_range + ': a protocol that has run tokenless for three years is a likelier, sturdier launch than a three-week one. ' +
      'Unknown ages count as ' + M.unknown_age_days + ' days.</li>' +
      '<li><strong>No name is special-cased:</strong> one function scores every row from its record alone. The factors are rounded to ' +
      '4 places before they are applied, so the detail view of any protocol recomputes its board figure to the dollar.</li>' +
      '</ul>' +
      '<h2>Peer multiples by category</h2>' +
      '<table class="mini"><thead><tr><th>Category</th><th>Launched peers</th><th>Median MCap / TVL</th></tr></thead><tbody>' + multRows +
      '<tr><td><strong>All peers (fallback)</strong></td><td class="num">' + DATA.peer_count + '</td><td class="num">' + fmtMult(DATA.peer_global_multiple) + 'x</td></tr>' +
      '</tbody></table>' +
      '<h2>Farm plans</h2>' +
      '<p>Every row carries a <strong>seven-step plan</strong> generated from its own record, never a hand-written list: the two money ' +
      'steps follow its category (supply and borrow for lending, liquidity and swaps for a DEX, crossings for a bridge), the position ' +
      'size follows its TVL tier ($50 to $250), the weekly cadence is priced for its chain (Ethereum mainnet costs more than an L2), ' +
      'and the holding period follows its age: younger protocols get a longer qualifying window. Each step states what it costs and ' +
      'how long it takes.</p>' +
      '<h2>Limits</h2>' +
      '<p>The snapshot is one day\'s figures and the model prices a launch <em>as if today</em>: it cannot see a points programme, a ' +
      'fundraise or a team\'s intent, and a protocol may never issue a token at all. Treat the ranking as a reading order for your ' +
      'own research, strongest first.</p>' +
      '</div>' + footer();
    app.setAttribute('aria-busy', 'false');
    wireTabs();
  }

  /* ---------------- Routing ---------------- */

  function wireTabs() {
    app.querySelectorAll('.tab').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-tab');
        location.hash = t === 'board' ? '#/board' : '#/' + t;
      });
    });
  }

  function route() {
    var h = location.hash || '#/board';
    var m;
    if ((m = h.match(/^#\/protocol\/(.+)$/))) { detailView(decodeURIComponent(m[1])); return; }
    if (h.indexOf('#/live') === 0) { liveView(); return; }
    if (h.indexOf('#/method') === 0) { methodView(); return; }
    var qi = h.indexOf('?');
    if (qi !== -1) {
      var params = new URLSearchParams(h.slice(qi + 1));
      state.q = params.get('q') || '';
      state.category = params.get('category') || 'all';
      state.chain = params.get('chain') || 'all';
      state.tier = params.get('tier') || 'all';
    }
    boardView();
  }

  window.addEventListener('hashchange', route);
  route();
})();
