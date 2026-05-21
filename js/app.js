/* ── Domain Finder — Main App ─────────────────────────────────
   Depends on: domain-generator.js (loaded first)
   ─────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* ── Config ─────────────────────────────────────────────── */
  // Update this URL after deploying the Catalyst function to production
  var CATALYST_LEADS_URL =
    'https://newppp-766202007.development.catalystserverless.com/server/leads_api';

  var RDAP_BASE = 'https://rdap.registro.br';
  var DELAY_MS  = 300;

  /* ── Data ───────────────────────────────────────────────── */
  var SECTORS = [
    { v:'tech',         l:'Tecnologia',  i:'💻' },
    { v:'retail',       l:'Varejo',       i:'🛍️' },
    { v:'health',       l:'Saúde',        i:'🏥' },
    { v:'education',    l:'Educação',     i:'🎓' },
    { v:'finance',      l:'Financeiro',   i:'💰' },
    { v:'services',     l:'Serviços',     i:'🤝' },
    { v:'food',         l:'Alimentação',  i:'🍽️' },
    { v:'construction', l:'Construção',   i:'🏗️' },
    { v:'other',        l:'Outro',        i:'📦' },
  ];

  var AUDIENCES = [
    { v:'b2c',  l:'B2C',   d:'Pessoas físicas' },
    { v:'b2b',  l:'B2B',   d:'Empresas' },
    { v:'both', l:'Ambos', d:'Todos os públicos' },
  ];

  var STYLES = [
    { v:'descriptive', l:'Descritivo',  d:'Nome completo e variações', i:'📝' },
    { v:'short',       l:'Curto',        d:'Siglas e versões compactas', i:'⚡' },
    { v:'creative',    l:'Criativo',     d:'Prefixos modernos (go, my…)', i:'✨' },
    { v:'location',    l:'Localização',  d:'Adiciona SP, RJ, BR…', i:'📍' },
  ];

  var STEP_LABELS = ['Contato','Empresa','Negócio','Estilo'];

  /* ── State ──────────────────────────────────────────────── */
  var state = {
    step: 0,
    form: {
      name:'', email:'', phone:'',
      companyName:'', sector:'',
      keywords:[], audience:'b2c', style:'descriptive',
    },
    kwInput: '',
    results: [],
    status: 'idle',
    filter: 'all',
    leadSaved: false,
  };

  var searchAborted = false;
  var progressTimer = null;

  /* ── Helpers ────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function validEmail(e) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function setForm(patch) {
    Object.assign(state.form, patch);
    render();
  }

  /* ── RDAP check ─────────────────────────────────────────── */
  function checkDomain(domain) {
    return fetch(RDAP_BASE + '/domain/' + domain, {
      headers: { Accept: 'application/rdap+json' }
    }).then(function (res) {
      if (res.status === 404) return { domain: domain, status: 'available' };
      if (res.ok)             return { domain: domain, status: 'taken' };
      return { domain: domain, status: 'error' };
    }).catch(function () {
      return { domain: domain, status: 'error' };
    });
  }

  /* ── Lead save ──────────────────────────────────────────── */
  function saveLead() {
    var f = state.form;
    fetch(CATALYST_LEADS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: f.name, email: f.email, phone: f.phone,
        company_name: f.companyName, sector: f.sector,
        keywords: f.keywords, audience: f.audience,
        domain_style: f.style,
      }),
    }).then(function () {
      state.leadSaved = true;
      var notice = document.getElementById('saved-notice');
      if (notice) notice.style.display = 'flex';
    }).catch(function () { /* non-blocking */ });
  }

  /* ── Search ─────────────────────────────────────────────── */
  function handleSearch() {
    searchAborted = false;
    var domains = generateDomains(state.form);
    state.results = domains.map(function (d) { return { domain: d, status: 'checking' }; });
    state.status  = 'loading';
    state.step    = 4;
    state.filter  = 'all';
    render();
    saveLead();
    runChecks(0);
  }

  function runChecks(i) {
    if (searchAborted || i >= state.results.length) {
      if (!searchAborted) {
        state.status = 'done';
        var pb = document.getElementById('progress-bar');
        if (pb) pb.style.display = 'none';
        showFilterTabs();
        updateSubtitle();
      }
      if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
      return;
    }
    var item = state.results[i];
    checkDomain(item.domain).then(function (result) {
      state.results[i] = result;
      patchCard(result);
      updateProgressBar();
      return sleep(DELAY_MS);
    }).then(function () {
      runChecks(i + 1);
    });
  }

  function patchCard(result) {
    var id = 'dc-' + result.domain.replace(/\./g, '_');
    var el = document.getElementById(id);
    if (!el) return;
    var cls = result.status === 'available' ? 'available' : 'taken';
    el.className  = 'd-card ' + cls;
    el.style.animation = 'none';
    el.innerHTML  = domainCardInner(result);
  }

  function updateProgressBar() {
    var fill = document.getElementById('progress-fill');
    if (!fill) return;
    var done = state.results.filter(function (r) { return r.status !== 'checking'; }).length;
    fill.style.width = (done / state.results.length * 100) + '%';
  }

  function updateSubtitle() {
    var el = document.getElementById('result-sub');
    if (!el) return;
    var av = state.results.filter(function (r) { return r.status === 'available'; }).length;
    el.textContent = state.results.length + ' sugestões · ' + av +
      ' disponíve' + (av === 1 ? 'l' : 'is');
  }

  function showFilterTabs() {
    var ft = document.getElementById('filter-tabs');
    if (!ft) return;
    ft.style.display = 'flex';
    ft.innerHTML = filterTabsHTML();
    attachFilterTabs();
  }

  function filterTabsHTML() {
    var av = state.results.filter(function (r) { return r.status === 'available'; }).length;
    var tk = state.results.filter(function (r) { return r.status === 'taken'; }).length;
    return [
      { k:'all',        l:'Todos (' + state.results.length + ')' },
      { k:'available',  l:'Disponíveis (' + av + ')' },
      { k:'registered', l:'Registrados (' + tk + ')' },
    ].map(function (t) {
      return '<button class="filter-tab' + (state.filter === t.k ? ' active' : '') +
             '" data-f="' + t.k + '">' + t.l + '</button>';
    }).join('');
  }

  function rebuildDomainList() {
    var list  = document.getElementById('domain-list');
    if (!list) return;
    var items = state.filter === 'available'
      ? state.results.filter(function (r) { return r.status === 'available'; })
      : state.filter === 'registered'
      ? state.results.filter(function (r) { return r.status === 'taken'; })
      : state.results;
    list.innerHTML = items.map(domainCardHTML).join('');
  }

  /* ── HTML builders ──────────────────────────────────────── */
  function stepper() {
    var s = Math.min(state.step, 4);
    var html = '<div class="stepper">';
    STEP_LABELS.forEach(function (label, i) {
      var dotCls = i < s ? 'done' : i === s ? 'active' : 'idle';
      var lblClr = i <= s ? 'rgba(255,255,255,.65)' : 'rgba(255,255,255,.22)';
      html += '<div class="step-item">' +
        '<div class="step-dot ' + dotCls + '">' + (i < s ? '✓' : i + 1) + '</div>' +
        '<span class="step-label" style="color:' + lblClr + '">' + label + '</span>' +
        '</div>';
      if (i < STEP_LABELS.length - 1) {
        html += '<div class="step-line ' + (i < s ? 'done' : 'idle') + '"></div>';
      }
    });
    return html + '</div>';
  }

  function fieldHTML(id, label, type, value, placeholder, optional) {
    return '<div class="field">' +
      '<label for="' + id + '">' + label +
      (optional ? ' <span>(opcional)</span>' : '') + '</label>' +
      '<input id="' + id + '" type="' + type + '" value="' + esc(value) +
      '" placeholder="' + esc(placeholder) + '" autocomplete="off" />' +
      '</div>';
  }

  function sectorGrid() {
    return '<div class="grid-3">' +
      SECTORS.map(function (s) {
        return '<div class="sel-card sel-card-sm' +
          (state.form.sector === s.v ? ' active' : '') +
          '" data-type="sector" data-v="' + s.v + '">' +
          '<span class="icon">' + s.i + '</span>' +
          '<span class="lbl">' + s.l + '</span></div>';
      }).join('') + '</div>';
  }

  function audienceGrid() {
    return '<div class="grid-3">' +
      AUDIENCES.map(function (a) {
        return '<div class="sel-card sel-card-md' +
          (state.form.audience === a.v ? ' active' : '') +
          '" data-type="audience" data-v="' + a.v + '">' +
          '<div class="lbl">' + a.l + '</div>' +
          '<div class="desc">' + a.d + '</div></div>';
      }).join('') + '</div>';
  }

  function styleGrid() {
    return '<div class="grid-2">' +
      STYLES.map(function (s) {
        return '<div class="sel-card sel-card-lg' +
          (state.form.style === s.v ? ' active' : '') +
          '" data-type="style" data-v="' + s.v + '">' +
          '<span class="icon">' + s.i + '</span>' +
          '<div class="lbl">' + s.l + '</div>' +
          '<div class="desc">' + s.d + '</div></div>';
      }).join('') + '</div>';
  }

  function kwSection() {
    return '<div class="field">' +
      '<label>Palavras-chave <span>(até 5 — Enter para adicionar)</span></label>' +
      '<div class="kw-row">' +
      '<input id="kw-input" type="text" value="' + esc(state.kwInput) +
      '" placeholder="inovação, automação…" />' +
      '<button id="kw-add" ' + (state.form.keywords.length >= 5 ? 'disabled' : '') + '>+</button>' +
      '</div>' +
      '<div class="tag-list">' +
      state.form.keywords.map(function (k) {
        return '<span class="tag">' + esc(k) +
          '<button type="button" data-kw="' + esc(k) + '">×</button></span>';
      }).join('') + '</div></div>';
  }

  function summaryBox() {
    var sectorLabel   = (SECTORS.find(function (s) { return s.v === state.form.sector; }) || {}).l;
    var audienceLabel = (AUDIENCES.find(function (a) { return a.v === state.form.audience; }) || {}).l;
    var pills = [
      state.form.name, state.form.email,
      state.form.companyName, sectorLabel,
    ].concat(state.form.keywords).concat([audienceLabel])
     .filter(Boolean)
     .map(function (p) { return '<span class="pill">' + esc(p) + '</span>'; })
     .join('');
    return '<div class="summary-box"><p>Resumo da busca</p>' +
      '<div class="summary-pills">' + pills + '</div></div>';
  }

  function domainCardInner(r) {
    var isAvail = r.status === 'available';
    var label   = isAvail ? 'Disponível' : r.status === 'taken' ? 'Registrado' : '…';
    return '<div class="d-left">' +
      '<span class="d-dot ' + r.status + '"></span>' +
      '<span class="d-name ' + r.status + '">' + esc(r.domain) + '</span>' +
      '</div><div class="d-right">' +
      '<span class="badge ' + r.status + '">' + label + '</span>' +
      (isAvail
        ? '<a class="register-btn" href="https://registro.br/busca-dominio/?fqdn=' +
          esc(r.domain) + '" target="_blank" rel="noopener">Registrar</a>'
        : '') +
      '</div>';
  }

  function domainCardHTML(r) {
    var cls = r.status === 'available' ? 'available' : r.status === 'taken' ? 'taken' : 'checking';
    return '<li class="d-card ' + cls + '" id="dc-' + r.domain.replace(/\./g, '_') + '">' +
      domainCardInner(r) + '</li>';
  }

  /* ── Render ─────────────────────────────────────────────── */
  function render() {
    var el = document.getElementById('main');
    if (!el) return;
    var f  = state.form;

    /* Results view */
    if (state.step === 4) {
      var av = state.results.filter(function (r) { return r.status === 'available'; }).length;
      el.innerHTML =
        '<div class="results-wrap">' +
          '<div class="results-header">' +
            '<div><h2>Sugestões de domínio</h2>' +
            '<p id="result-sub">' +
              (state.status === 'loading' ? 'Verificando domínios…'
                : state.results.length + ' sugestões · ' + av + ' disponíve' + (av===1?'l':'is')) +
            '</p></div>' +
            '<button class="btn-new" id="btn-new">← Nova busca</button>' +
          '</div>' +
          '<div id="saved-notice" class="saved-notice" style="display:' + (state.leadSaved?'flex':'none') + '">' +
            '✓ Seus dados foram salvos — entraremos em contato.' +
          '</div>' +
          '<div class="progress-bar" id="progress-bar" style="' + (state.status==='done'?'display:none':'') + '">' +
            '<div class="progress-fill" id="progress-fill" style="width:0%"></div>' +
          '</div>' +
          '<div class="filter-tabs" id="filter-tabs" style="' + (state.status!=='done'?'display:none':'') + '">' +
            filterTabsHTML() +
          '</div>' +
          '<ul id="domain-list">' +
            state.results.map(domainCardHTML).join('') +
          '</ul>' +
          '<p class="rdap-note">Consulta via RDAP · Registro.br</p>' +
        '</div>';
      attachResults();
      return;
    }

    var inner = '';

    /* Step 0 — Contact */
    if (state.step === 0) {
      var ok0 = f.name.trim().length >= 2 && validEmail(f.email);
      inner =
        '<div class="card">' + stepper() +
        '<p class="step-eyebrow">Etapa 1 de 4</p>' +
        '<h2 class="step-title">Quem está buscando?</h2>' +
        '<p class="step-sub">Vamos personalizar as sugestões para você.</p>' +
        fieldHTML('f-name',  'Nome completo', 'text',  f.name,  'Seu nome', false) +
        fieldHTML('f-email', 'E-mail',        'email', f.email, 'voce@empresa.com.br', false) +
        fieldHTML('f-phone', 'Telefone',      'tel',   f.phone, '(11) 99999-9999', true) +
        '<button class="btn btn-full" id="btn-next-0" ' + (ok0 ? '' : 'disabled') + '>Continuar →</button>' +
        '</div>';
    }

    /* Step 1 — Company */
    if (state.step === 1) {
      var ok1 = f.companyName.trim().length >= 2 && !!f.sector;
      inner =
        '<div class="card">' + stepper() +
        '<p class="step-eyebrow">Etapa 2 de 4</p>' +
        '<h2 class="step-title">Sobre a empresa</h2>' +
        '<p class="step-sub">Nome e setor de atuação.</p>' +
        fieldHTML('f-company','Nome da empresa ou marca','text',f.companyName,'Ex: Empresa ABC, Studio Digital…',false) +
        '<div class="field"><label>Setor de atuação</label>' + sectorGrid() + '</div>' +
        '<div class="btn-row">' +
          '<button class="btn btn-back" id="btn-back">← Voltar</button>' +
          '<button class="btn btn-next" id="btn-next-1" ' + (ok1 ? '' : 'disabled') + '>Continuar →</button>' +
        '</div></div>';
    }

    /* Step 2 — Business */
    if (state.step === 2) {
      inner =
        '<div class="card">' + stepper() +
        '<p class="step-eyebrow">Etapa 3 de 4</p>' +
        '<h2 class="step-title">Detalhes do negócio</h2>' +
        '<p class="step-sub">Quanto mais contexto, melhores as sugestões.</p>' +
        kwSection() +
        '<div class="field" style="margin-top:20px"><label>Público-alvo</label>' + audienceGrid() + '</div>' +
        '<div class="btn-row">' +
          '<button class="btn btn-back" id="btn-back">← Voltar</button>' +
          '<button class="btn btn-next" id="btn-next-2">Continuar →</button>' +
        '</div></div>';
    }

    /* Step 3 — Style */
    if (state.step === 3) {
      inner =
        '<div class="card">' + stepper() +
        '<p class="step-eyebrow">Etapa 4 de 4</p>' +
        '<h2 class="step-title">Estilo do domínio</h2>' +
        '<p class="step-sub">Qual formato combina com a sua marca?</p>' +
        '<div class="field">' + styleGrid() + '</div>' +
        summaryBox() +
        '<div class="btn-row">' +
          '<button class="btn btn-back" id="btn-back">← Voltar</button>' +
          '<button class="btn btn-next" id="btn-search">🔍 Buscar domínios</button>' +
        '</div></div>';
    }

    el.innerHTML = inner;
    attachForm();
  }

  /* ── Event wiring ───────────────────────────────────────── */
  function attachForm() {
    var step = state.step;

    /* Text inputs */
    var inputMap = {
      'f-name':    function (v) { setForm({ name: v }); },
      'f-email':   function (v) { setForm({ email: v }); },
      'f-phone':   function (v) { setForm({ phone: v }); },
      'f-company': function (v) { setForm({ companyName: v }); },
    };
    Object.keys(inputMap).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', function () { inputMap[id](el.value); });
      el.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        var nxt = document.getElementById(
          step === 0 ? 'btn-next-0' : step === 1 ? 'btn-next-1' : null
        );
        if (nxt && !nxt.disabled) nxt.click();
      });
    });
    /* autofocus */
    var first = document.getElementById('f-name') || document.getElementById('f-company');
    if (first) setTimeout(function () { first.focus(); }, 50);

    /* Selector cards */
    document.querySelectorAll('[data-type]').forEach(function (card) {
      card.addEventListener('click', function () {
        var t = card.dataset.type, v = card.dataset.v;
        var patch = {};
        patch[t === 'sector' ? 'sector' : t === 'audience' ? 'audience' : 'style'] = v;
        setForm(patch);
      });
    });

    /* Keyword input */
    var kwIn  = document.getElementById('kw-input');
    var kwAdd = document.getElementById('kw-add');
    if (kwIn) {
      kwIn.addEventListener('input', function () { state.kwInput = kwIn.value; });
      kwIn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addKeyword(); }
      });
      setTimeout(function () { kwIn.focus(); }, 50);
    }
    if (kwAdd) kwAdd.addEventListener('click', addKeyword);

    /* Tag remove */
    document.querySelectorAll('[data-kw]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setForm({ keywords: state.form.keywords.filter(function (k) { return k !== btn.dataset.kw; }) });
      });
    });

    /* Navigation */
    var back = document.getElementById('btn-back');
    if (back) back.addEventListener('click', function () { state.step--; render(); });

    var n0 = document.getElementById('btn-next-0');
    if (n0) n0.addEventListener('click', function () { state.step = 1; render(); });

    var n1 = document.getElementById('btn-next-1');
    if (n1) n1.addEventListener('click', function () { state.step = 2; render(); });

    var n2 = document.getElementById('btn-next-2');
    if (n2) n2.addEventListener('click', function () { state.step = 3; render(); });

    var srch = document.getElementById('btn-search');
    if (srch) srch.addEventListener('click', handleSearch);
  }

  function attachResults() {
    var nb = document.getElementById('btn-new');
    if (nb) nb.addEventListener('click', function () {
      searchAborted = true;
      state.step = 0; state.results = []; state.status = 'idle';
      state.leadSaved = false; state.filter = 'all';
      render();
    });
    attachFilterTabs();
  }

  function attachFilterTabs() {
    document.querySelectorAll('.filter-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.filter = btn.dataset.f;
        showFilterTabs();
        rebuildDomainList();
      });
    });
  }

  function addKeyword() {
    var kw = state.kwInput.trim();
    if (kw && state.form.keywords.indexOf(kw) === -1 && state.form.keywords.length < 5) {
      state.kwInput = '';
      setForm({ keywords: state.form.keywords.concat([kw]) });
    }
  }

  /* ── Boot ───────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }

})();
