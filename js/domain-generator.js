/* ── Domain Generator ─────────────────────────────────────────
   Exposed as a single global function: generateDomains(formData)
   ─────────────────────────────────────────────────────────── */
(function (global) {

  var BIZ_SUFFIXES = [
    'ltda','me','sa','eireli','ei','ss','epp','sas','grupo','group',
    'sociedade','comercio','comercial','industria','industrial',
  ];

  var SECTOR_TERMS = {
    tech:         ['tech','digital','sistemas','dev','software','cloud','ai'],
    retail:       ['loja','store','shop','vendas','compras'],
    health:       ['saude','health','med','clinica','vida','bem'],
    education:    ['edu','cursos','learn','escola','academy'],
    finance:      ['financeiro','fin','capital','invest','contabil'],
    services:     ['solucoes','pro','expert','hub','connect'],
    food:         ['food','chef','sabor','gourmet','nutri'],
    construction: ['obras','engenharia','imoveis','construtora'],
    other:        ['brasil','br','online','web','plus'],
  };

  var STYLE_PREFIXES = {
    creative: ['get','my','go','be','try'],
  };

  var STYLE_SUFFIXES = {
    descriptive: ['digital','online','brasil','web'],
    location:    ['sp','rj','br','brasil','mg'],
    creative:    ['hub','lab','app','link','hq'],
  };

  function slugify(text) {
    return String(text)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  }

  function generateDomains(form) {
    var companyName = form.companyName || '';
    var sector      = form.sector      || 'other';
    var keywords    = form.keywords    || [];
    var audience    = form.audience    || 'b2c';
    var style       = form.style       || 'descriptive';

    if (!companyName.trim()) return [];

    var words = slugify(companyName).split('-').filter(function (w) {
      return w.length > 0 && BIZ_SUFFIXES.indexOf(w) === -1;
    });
    if (!words.length) return [];

    var base   = words.join('');
    var hyphen = words.length > 1 ? words.join('-') : null;
    var abbrev = words.map(function (w) { return w[0]; }).join('');

    var kwSlugs = keywords
      .map(function (k) { return slugify(k).replace(/-/g, ''); })
      .filter(function (k) { return k.length >= 2; });

    var sts = SECTOR_TERMS[sector] || SECTOR_TERMS.other;
    var pfx = STYLE_PREFIXES[style] || [];
    var sfx = STYLE_SUFFIXES[style] || [];

    var seen = {};
    var list = [];

    function add(d) {
      if (!seen[d] && d.length >= 2 && d.length <= 63) { seen[d] = 1; list.push(d); }
    }

    add(base);
    if (hyphen) add(hyphen);

    if (style === 'short' && abbrev.length >= 2) {
      add(abbrev);
      if (words.length > 1) add(words[0]);
    }

    sts.slice(0, 4).forEach(function (t) {
      add(base + t);
      if (style !== 'short') add(t + base);
    });

    kwSlugs.forEach(function (k) {
      add(base + k);
      add(k + base);
      if (words.length > 1) add(words[0] + k);
    });

    pfx.forEach(function (p) { if (base.indexOf(p) !== 0) add(p + base); });
    sfx.forEach(function (s) { if (base.slice(-s.length) !== s) add(base + s); });

    if (audience === 'b2b') { add(base + 'b2b'); add(base + 'empresas'); }
    if (audience === 'b2c') add(base + 'online');

    return list.slice(0, 20).map(function (d) { return d + '.com.br'; });
  }

  global.generateDomains = generateDomains;

})(window);
