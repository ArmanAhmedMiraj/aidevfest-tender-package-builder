/* tests.js - runs in Chrome (tests.html) and in Node ("node js/tests.js"). Tests the pure logic only. */
(function () {
  'use strict';
  var isNode = (typeof module !== 'undefined' && module.exports);
  var L = isNode ? require('./logic.js') : window.Logic;
  var results = [], pending = [];

  function test(name, fn) {
    try {
      var r = fn();
      if (r && typeof r.then === 'function') {
        pending.push(r.then(function () { results.push({ name: name, ok: true }); },
          function (e) { results.push({ name: name, ok: false, msg: String(e.message || e) }); }));
      } else { results.push({ name: name, ok: true }); }
    } catch (e) { results.push({ name: name, ok: false, msg: String(e.message || e) }); }
  }
  function eq(actual, expected, label) {
    var a = JSON.stringify(actual), b = JSON.stringify(expected);
    if (a !== b) throw new Error((label ? label + ': ' : '') + 'expected ' + b + ' but got ' + a);
  }

  var SAMPLE = '{"tender":{"tender_id":"T-2026-0417","title":"Supply of IT Equipment","procuring_entity":"Directorate of Sample Services","bidder":"Meghna Tech Solutions Ltd.","submission_deadline":"2026-10-20"},"requirements":[' +
    '{"id":"R01","order":1,"title_en":"Trade License","title_bn":"\u099f\u09cd\u09b0\u09c7\u09a1 \u09b2\u09be\u0987\u09b8\u09c7\u09a8\u09cd\u09b8","mandatory":true,"has_expiry":true},' +
    '{"id":"R02","order":2,"title_en":"TIN Certificate","title_bn":"\u099f\u09bf\u0986\u0987\u098f\u09a8 \u09b8\u09a8\u09a6","mandatory":true,"has_expiry":false},' +
    '{"id":"R03","order":3,"title_en":"VAT Registration Certificate","title_bn":"\u09ad\u09cd\u09af\u09be\u099f \u09a8\u09bf\u09ac\u09a8\u09cd\u09a7\u09a8 \u09b8\u09a8\u09a6","mandatory":true,"has_expiry":false},' +
    '{"id":"R04","order":4,"title_en":"Bank Solvency Certificate","title_bn":"\u09ac\u09cd\u09af\u09be\u0982\u0995 \u09b8\u099a\u09cd\u099b\u09b2\u09a4\u09be \u09b8\u09a8\u09a6","mandatory":true,"has_expiry":true},' +
    '{"id":"R05","order":5,"title_en":"Experience Certificate","title_bn":"\u0985\u09ad\u09bf\u099c\u09cd\u099e\u09a4\u09be\u09b0 \u09b8\u09a8\u09a6","mandatory":true,"has_expiry":false},' +
    '{"id":"R06","order":6,"title_en":"Audited Financial Statement","title_bn":"\u09a8\u09bf\u09b0\u09c0\u0995\u09cd\u09b7\u09bf\u09a4 \u0986\u09b0\u09cd\u09a5\u09bf\u0995 \u09ac\u09bf\u09ac\u09b0\u09a3\u09c0","mandatory":false,"has_expiry":false},' +
    '{"id":"R07","order":7,"title_en":"Manufacturer\'s Authorization","title_bn":"\u09aa\u09cd\u09b0\u09b8\u09cd\u09a4\u09c1\u09a4\u0995\u09be\u09b0\u0995\u09c7\u09b0 \u0985\u09a8\u09c1\u09ae\u09cb\u09a6\u09a8\u09aa\u09a4\u09cd\u09b0","mandatory":false,"has_expiry":true},' +
    '{"id":"R08","order":8,"title_en":"Technical Proposal","title_bn":"\u0995\u09be\u09b0\u09bf\u0997\u09b0\u09bf \u09aa\u09cd\u09b0\u09b8\u09cd\u09a4\u09be\u09ac","mandatory":true,"has_expiry":false},' +
    '{"id":"R09","order":9,"title_en":"Financial Proposal","title_bn":"\u0986\u09b0\u09cd\u09a5\u09bf\u0995 \u09aa\u09cd\u09b0\u09b8\u09cd\u09a4\u09be\u09ac","mandatory":true,"has_expiry":false},' +
    '{"id":"R10","order":10,"title_en":"Signed Declaration","title_bn":"\u09b8\u09cd\u09ac\u09be\u0995\u09cd\u09b7\u09b0\u09bf\u09a4 \u0998\u09cb\u09b7\u09a3\u09be\u09aa\u09a4\u09cd\u09b0","mandatory":true,"has_expiry":false}]}';

  function mk(extra) {
    var o = JSON.parse(SAMPLE);
    if (extra) extra(o);
    return JSON.stringify(o);
  }
  var DL = '2026-10-20';
  function R(mandatory, hasExpiry) { return { id: 'X', order: 1, title_en: 'X', title_bn: '', mandatory: mandatory, hasExpiry: hasExpiry }; }
  function M(expiry) { return { fileId: 'f1', expiry: expiry === undefined ? '' : expiry }; }

  /* ----- dates ----- */
  test('date: valid dates accepted', function () {
    eq(L.isValidDate('2026-10-20'), true); eq(L.isValidDate('2028-02-29'), true); eq(L.isValidDate('2026-12-31'), true);
  });
  test('date: invalid dates rejected', function () {
    ['2026-02-30', '2026-13-01', '2026-00-10', '2026-10-00', '2026-1-1', '', null, undefined, '20261020', '2027-02-29', '0999-01-01', '2026-10-20 ', 'abc']
      .forEach(function (s) { eq(L.isValidDate(s), false, String(s)); });
  });
  test('date: compare', function () {
    eq(L.compareDates('2026-10-19', DL), -1); eq(L.compareDates(DL, DL), 0); eq(L.compareDates('2026-10-21', DL), 1);
  });
  test('date: local date formatting (not UTC)', function () {
    eq(L.todayLocal(new Date(2026, 9, 6, 0, 5)), '2026-10-06', 'just after midnight local');
    eq(L.todayLocal(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  });
  test('date: display format', function () {
    eq(L.formatDateDisplay('2025-06-30'), '30 Jun 2025'); eq(L.formatDateDisplay('2026-12-01'), '1 Dec 2026'); eq(L.formatDateDisplay('bad'), '');
  });

  /* ----- status rules (Section 5) ----- */
  test('status: mandatory, no file -> missing', function () { eq(L.statusOf(R(true, false), null, DL), 'missing'); });
  test('status: mandatory with expiry, no file -> missing', function () { eq(L.statusOf(R(true, true), null, DL), 'missing'); });
  test('status: optional, no file -> not_provided', function () { eq(L.statusOf(R(false, false), undefined, DL), 'not_provided'); });
  test('status: optional with expiry, no file -> not_provided', function () { eq(L.statusOf(R(false, true), null, DL), 'not_provided'); });
  test('status: matched, no expiry needed -> ok', function () { eq(L.statusOf(R(true, false), M(), DL), 'ok'); });
  test('status: matched, has_expiry, no date -> expiry_needed', function () { eq(L.statusOf(R(true, true), M(''), DL), 'expiry_needed'); });
  test('status: invalid date text -> expiry_needed', function () { eq(L.statusOf(R(true, true), M('2026-02-30'), DL), 'expiry_needed'); });
  test('status: day before deadline -> expired', function () { eq(L.statusOf(R(true, true), M('2026-10-19'), DL), 'expired'); });
  test('status: SAME DAY as deadline -> ok', function () { eq(L.statusOf(R(true, true), M('2026-10-20'), DL), 'ok'); });
  test('status: day after deadline -> ok', function () { eq(L.statusOf(R(true, true), M('2026-10-21'), DL), 'ok'); });
  test('status: expires after today but before deadline -> expired', function () { eq(L.statusOf(R(true, true), M('2026-10-10'), DL), 'expired'); });
  test('status: sample 2025 trade license -> expired', function () { eq(L.statusOf(R(true, true), M('2025-06-30'), DL), 'expired'); });
  test('status: sample 2026 trade license -> ok', function () { eq(L.statusOf(R(true, true), M('2027-06-30'), DL), 'ok'); });
  test('status: sample bank solvency -> ok', function () { eq(L.statusOf(R(true, true), M('2026-12-31'), DL), 'ok'); });
  test('status: optional + expiry + matched + no date -> expiry_needed (blocks)', function () { eq(L.statusOf(R(false, true), M(''), DL), 'expiry_needed'); });
  test('status: optional + expiry + matched + expired -> expired (blocks)', function () { eq(L.statusOf(R(false, true), M('2026-01-01'), DL), 'expired'); });
  test('status: has_expiry=false ignores a stale date', function () { eq(L.statusOf(R(true, false), M('2000-01-01'), DL), 'ok'); });
  test('status: blocking flags', function () {
    eq(L.BLOCKING, { missing: true, expiry_needed: true, expired: true, not_provided: false, ok: false });
    eq(L.STATUS_LABEL_EN, { missing: 'Missing', expiry_needed: 'Expiry date needed', expired: 'Expired', not_provided: 'Not provided', ok: 'OK' });
  });

  /* ----- requirements.json parsing ----- */
  test('parse: sample file is valid and sorted', function () {
    var p = L.parseRequirements(SAMPLE);
    eq(p.ok, true); eq(p.tender.tender_id, 'T-2026-0417'); eq(p.tender.submission_deadline, DL);
    eq(p.requirements.map(function (r) { return r.id; }), ['R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R10']);
    eq(p.requirements[6].mandatory, false); eq(p.requirements[6].hasExpiry, true);
  });
  test('parse: BOM at start is tolerated', function () { eq(L.parseRequirements('\ufeff' + SAMPLE).ok, true); });
  test('parse: shuffled array is sorted by order, not by position or id', function () {
    var p = L.parseRequirements(mk(function (o) { o.requirements.reverse(); o.requirements[0].order = 1; }));
    eq(p.ok, true);
    eq(p.requirements.map(function (r) { return r.order; }), [1, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  test('parse: ties keep original array order', function () {
    var p = L.parseRequirements(mk(function (o) { o.requirements[0].order = 5; }));
    eq(p.requirements.map(function (r) { return r.id; }).slice(2, 5), ['R04', 'R01', 'R05']);
  });
  test('parse: gaps in order values are fine', function () {
    var p = L.parseRequirements(mk(function (o) { o.requirements.forEach(function (r, i) { r.order = (i + 1) * 10; }); }));
    eq(p.ok, true);
  });
  test('parse: numeric-string order and boolean strings are coerced', function () {
    var p = L.parseRequirements(mk(function (o) { o.requirements[1].order = '2'; o.requirements[1].mandatory = 'true'; o.requirements[1].has_expiry = 'false'; }));
    eq(p.ok, true); eq(p.requirements[1].mandatory, true); eq(p.requirements[1].hasExpiry, false);
  });
  test('parse: bad JSON', function () { eq(L.parseRequirements('{nope').error.key, 'json_invalid'); });
  test('parse: JSON array instead of object', function () { eq(L.parseRequirements('[]').error.key, 'json_structure'); });
  test('parse: missing tender', function () { eq(L.parseRequirements('{"requirements":[]}').error, { key: 'field_missing', params: { field: 'tender' } }); });
  test('parse: missing tender_id', function () {
    eq(L.parseRequirements(mk(function (o) { delete o.tender.tender_id; })).error.params.field, 'tender.tender_id');
  });
  test('parse: bad deadline format', function () {
    eq(L.parseRequirements(mk(function (o) { o.tender.submission_deadline = '20/10/2026'; })).error.key, 'deadline_invalid');
    eq(L.parseRequirements(mk(function (o) { o.tender.submission_deadline = '2026-02-30'; })).error.key, 'deadline_invalid');
  });
  test('parse: empty requirements', function () {
    eq(L.parseRequirements(mk(function (o) { o.requirements = []; })).error.key, 'req_empty');
  });
  test('parse: requirements not an array', function () {
    eq(L.parseRequirements(mk(function (o) { o.requirements = 'x'; })).error.params.field, 'requirements');
  });
  test('parse: duplicate requirement id', function () {
    eq(L.parseRequirements(mk(function (o) { o.requirements[1].id = 'R01'; })).error, { key: 'req_dup_id', params: { id: 'R01' } });
  });
  test('parse: bad boolean / order / id', function () {
    eq(L.parseRequirements(mk(function (o) { o.requirements[2].mandatory = 'yes'; })).error.params.field, 'mandatory');
    eq(L.parseRequirements(mk(function (o) { o.requirements[2].has_expiry = null; })).error.params.field, 'has_expiry');
    eq(L.parseRequirements(mk(function (o) { o.requirements[2].order = 'first'; })).error.params.field, 'order');
    eq(L.parseRequirements(mk(function (o) { o.requirements[2].id = ''; })).error.params.field, 'id');
  });
  test('parse: title fallbacks', function () {
    var p = L.parseRequirements(mk(function (o) { o.requirements[0].title_bn = ''; delete o.requirements[1].title_en; }));
    eq(L.titleFor(p.requirements[0], 'bn'), 'Trade License');
    eq(L.titleFor(p.requirements[1], 'en'), '\u099f\u09bf\u0986\u0987\u098f\u09a8 \u09b8\u09a8\u09a6');
    eq(L.titleFor(p.requirements[2], 'bn'), '\u09ad\u09cd\u09af\u09be\u099f \u09a8\u09bf\u09ac\u09a8\u09cd\u09a7\u09a8 \u09b8\u09a8\u09a6');
  });
  test('parse: no title at all is rejected', function () {
    eq(L.parseRequirements(mk(function (o) { o.requirements[0].title_en = ''; o.requirements[0].title_bn = ''; })).error.params.field, 'title_en');
  });
  test('parse: html in text stays plain data', function () {
    var p = L.parseRequirements(mk(function (o) { o.tender.bidder = '<b>x</b>'; }));
    eq(p.tender.bidder, '<b>x</b>');
  });

  /* ----- duplicates ----- */
  test('dup: identical hashes grouped, others not', function () {
    var d = L.duplicateGroups([{ id: 'a', hash: 'h1' }, { id: 'b', hash: 'h2' }, { id: 'c', hash: 'h1' }]);
    eq(Object.keys(d.groupOf).sort(), ['a', 'c']); eq(d.groups.h1, ['a', 'c']);
  });
  test('dup: three-way group', function () {
    var d = L.duplicateGroups([{ id: 'a', hash: 'x' }, { id: 'b', hash: 'x' }, { id: 'c', hash: 'x' }]);
    eq(d.groups.x.length, 3);
  });
  test('dup: no duplicates, and files without hash ignored', function () {
    eq(Object.keys(L.duplicateGroups([{ id: 'a', hash: '1' }, { id: 'b', hash: '2' }, { id: 'c' }, { id: 'd' }]).groupOf), []);
  });

  /* ----- matching ----- */
  var NODUP = L.duplicateGroups([]);
  test('match: assign and unassign', function () {
    var r = L.assign({}, 'R01', 'f1', NODUP); eq(r.ok, true); eq(r.matches, { R01: { fileId: 'f1', expiry: '' } });
    eq(L.assign(r.matches, 'R01', '', NODUP).matches, {});
  });
  test('match: a file can go to only one document', function () {
    var m = L.assign({}, 'R01', 'f1', NODUP).matches;
    var r = L.assign(m, 'R02', 'f1', NODUP);
    eq(r.ok, false); eq(r.reason, 'used_elsewhere'); eq(r.reqId, 'R01');
  });
  test('match: replacing the file clears the old expiry date', function () {
    var m = L.setExpiry(L.assign({}, 'R01', 'f1', NODUP).matches, 'R01', '2025-06-30');
    eq(m.R01.expiry, '2025-06-30');
    var r = L.assign(m, 'R01', 'f2', NODUP); eq(r.matches.R01, { fileId: 'f2', expiry: '' });
  });
  test('match: choosing the same file again keeps its date', function () {
    var m = L.setExpiry(L.assign({}, 'R01', 'f1', NODUP).matches, 'R01', '2027-06-30');
    eq(L.assign(m, 'R01', 'f1', NODUP).matches.R01.expiry, '2027-06-30');
  });
  test('match: assign never mutates the input', function () {
    var m = { R01: { fileId: 'f1', expiry: 'x' } }; var snap = JSON.stringify(m);
    L.assign(m, 'R02', 'f2', NODUP); L.setExpiry(m, 'R01', 'y'); L.removeFile(m, 'f1'); eq(JSON.stringify(m), snap);
  });
  test('match: duplicate cannot go to a different document', function () {
    var dup = L.duplicateGroups([{ id: 'a', hash: 'h' }, { id: 'b', hash: 'h' }]);
    var m = L.assign({}, 'R05', 'a', dup).matches;
    var r = L.assign(m, 'R02', 'b', dup); eq(r.ok, false); eq(r.reason, 'duplicate_used'); eq(r.reqId, 'R05');
  });
  test('match: duplicate may replace its twin on the SAME document', function () {
    var dup = L.duplicateGroups([{ id: 'a', hash: 'h' }, { id: 'b', hash: 'h' }]);
    var m = L.assign({}, 'R05', 'a', dup).matches;
    eq(L.assign(m, 'R05', 'b', dup).ok, true);
  });
  test('match: after unmatching, the twin is free again', function () {
    var dup = L.duplicateGroups([{ id: 'a', hash: 'h' }, { id: 'b', hash: 'h' }]);
    var m = L.assign({}, 'R05', 'a', dup).matches; m = L.assign(m, 'R05', '', dup).matches;
    eq(L.assign(m, 'R02', 'b', dup).ok, true);
  });
  test('match: removing a file unmatches it', function () {
    var m = L.assign(L.assign({}, 'R01', 'f1', NODUP).matches, 'R02', 'f2', NODUP).matches;
    eq(Object.keys(L.removeFile(m, 'f1')), ['R02']);
  });
  test('match: expiry on an unmatched document is ignored', function () { eq(L.setExpiry({}, 'R01', '2026-01-01'), {}); });

  /* ----- uploads ----- */
  var MB = 1024 * 1024;
  function fakeFiles(n, size) { var a = []; for (var i = 0; i < n; i++) a.push({ size: size }); return a; }
  test('limits: 30 files ok, 31st rejected', function () {
    eq(L.checkLimits(fakeFiles(29, 1), 1), null); eq(L.checkLimits(fakeFiles(30, 1), 1), 'too_many');
  });
  test('limits: exactly 50 MB ok, one byte over rejected', function () {
    eq(L.checkLimits(fakeFiles(1, 49 * MB), MB), null); eq(L.checkLimits(fakeFiles(1, 49 * MB), MB + 1), 'too_big');
  });
  test('pdf sniff: real header, junk before header, png, empty, header too late', function () {
    function bytes(s) { var u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; }
    eq(L.looksLikePdf(bytes('%PDF-1.7\n...')), true);
    eq(L.looksLikePdf(bytes('xxxxxxxxxxxxxxxxxxxx%PDF-1.4')), true);
    eq(L.looksLikePdf(bytes('\x89PNG\r\n\x1a\n')), false);
    eq(L.looksLikePdf(new Uint8Array(0)), false);
    eq(L.looksLikePdf(bytes(new Array(1100).join('x') + '%PDF-1.4')), false);
  });
  test('sha256: known value and equal content gives equal hash', function () {
    var enc = new TextEncoder();
    return Promise.all([L.sha256Hex(enc.encode('abc').buffer), L.sha256Hex(enc.encode('abc').buffer), L.sha256Hex(enc.encode('abd').buffer)]).then(function (h) {
      eq(h[0], 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
      eq(h[0], h[1]); if (h[0] === h[2]) throw new Error('different content gave same hash');
    });
  });

  /* ----- package ----- */
  test('footer text is exact', function () { eq(L.footerText('T-2026-0417', 1, 16), 'T-2026-0417 | Page 1 of 16'); });
  test('download name', function () {
    eq(L.downloadName('T-2026-0417'), 'T-2026-0417_Package.pdf');
    eq(L.downloadName('A/B:C*D'), 'A_B_C_D_Package.pdf');
  });
  test('winansi: Bangla and emoji become ?, curly quotes and accents stay', function () {
    eq(L.winAnsiSafe('\u099f\u09cd\u09b0\u09c7\u09a1'), '?????'); eq(L.winAnsiSafe('Manufacturer\u2019s caf\u00e9'), 'Manufacturer\u2019s caf\u00e9');
    eq(L.winAnsiSafe('a\nb'), 'a b'); eq(L.winAnsiSafe(null), '');
  });
  test('package: sample scenario = 16 pages, correct order and start pages', function () {
    var p = L.parseRequirements(SAMPLE);
    var files = [
      { id: 'tl25', name: 'trade_license_2025.pdf', pages: 1 }, { id: 'tl26', name: 'trade_license_2026.pdf', pages: 1 },
      { id: 'fin', name: '01_financial_proposal.pdf', pages: 2 }, { id: 'tech', name: '02_technical_proposal.pdf', pages: 6 },
      { id: 'tin', name: '03_tin_certificate.pdf', pages: 1 }, { id: 'vat', name: '04_vat_certificate.pdf', pages: 1 },
      { id: 'bank', name: 'bank_solvency.pdf', pages: 1 }, { id: 'exp', name: 'experience_cert.pdf', pages: 2 },
      { id: 'exp2', name: 'experience_cert (1).pdf', pages: 2 }, { id: 'scan', name: 'scan_0042.pdf', pages: 1 }
    ];
    var m = {};
    /* matched in a scrambled order on purpose */
    [['R10', 'scan'], ['R09', 'fin'], ['R08', 'tech'], ['R05', 'exp'], ['R04', 'bank', '2026-12-31'], ['R03', 'vat'], ['R02', 'tin'], ['R01', 'tl26', '2027-06-30']]
      .forEach(function (x) { m = L.assign(m, x[0], x[1], NODUP).matches; if (x[2]) m = L.setExpiry(m, x[0], x[2]); });
    var plan = L.packagePlan(p.requirements, m, files);
    eq(plan.totalPages, 16);
    eq(plan.items.map(function (i) { return i.req.id; }), ['R01', 'R02', 'R03', 'R04', 'R05', 'R08', 'R09', 'R10']);
    eq(plan.items.map(function (i) { return i.startPage; }), [2, 3, 4, 5, 6, 8, 14, 16]);
    var st = L.computeStatuses(p.requirements, m, DL);
    eq(L.blockingList(st).length, 0, 'no blocking problems');
    eq(st.filter(function (s) { return s.status === 'not_provided'; }).map(function (s) { return s.id; }), ['R06', 'R07']);
  });
  test('package: sample with the expired 2025 license is blocked', function () {
    var p = L.parseRequirements(SAMPLE);
    var m = L.setExpiry(L.assign({}, 'R01', 'tl25', NODUP).matches, 'R01', '2025-06-30');
    var st = L.computeStatuses(p.requirements, m, DL);
    eq(st[0].status, 'expired'); eq(st[1].status, 'missing'); eq(L.blockingList(st).length, 8);
  });
  test('package: optional document with a file is included in order', function () {
    var p = L.parseRequirements(SAMPLE);
    var m = L.assign(L.assign({}, 'R09', 'a', NODUP).matches, 'R07', 'b', NODUP).matches;
    var plan = L.packagePlan(p.requirements, m, [{ id: 'a', pages: 2 }, { id: 'b', pages: 3 }]);
    eq(plan.items.map(function (i) { return i.req.id; }), ['R07', 'R09']); eq(plan.totalPages, 6);
  });

  /* ----- run and report ----- */
  Promise.all(pending).then(function () {
    var failed = results.filter(function (r) { return !r.ok; });
    if (isNode) {
      results.forEach(function (r) { console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok ? '' : '  -> ' + r.msg)); });
      console.log('\n' + (results.length - failed.length) + ' passed, ' + failed.length + ' failed, ' + results.length + ' total');
      process.exit(failed.length ? 1 : 0);
    } else {
      var box = document.getElementById('results');
      var sum = document.getElementById('summary');
      sum.textContent = (results.length - failed.length) + ' passed, ' + failed.length + ' failed, ' + results.length + ' total';
      sum.className = failed.length ? 'bad' : 'good';
      results.forEach(function (r) {
        var li = document.createElement('li');
        li.className = r.ok ? 'good' : 'bad';
        li.textContent = (r.ok ? 'PASS  ' : 'FAIL  ') + r.name + (r.ok ? '' : '  -> ' + r.msg);
        box.appendChild(li);
      });
    }
  });
})();