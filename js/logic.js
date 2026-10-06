/* logic.js - pure functions only (no DOM, no PDF library).
   Loads as global "Logic" in Chrome and via require() in Node, so it can be tested alone. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.Logic = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_FILES = 30;
  var MAX_BYTES = 50 * 1024 * 1024;

  var STATUS = {
    MISSING: 'missing',
    EXPIRY_NEEDED: 'expiry_needed',
    EXPIRED: 'expired',
    NOT_PROVIDED: 'not_provided',
    OK: 'ok'
  };
  var STATUS_LABEL_EN = {
    missing: 'Missing',
    expiry_needed: 'Expiry date needed',
    expired: 'Expired',
    not_provided: 'Not provided',
    ok: 'OK'
  };
  var BLOCKING = { missing: true, expiry_needed: true, expired: true, not_provided: false, ok: false };

  /* ---------- dates (plain YYYY-MM-DD strings, never Date objects) ---------- */
  function isValidDate(s) {
    if (typeof s !== 'string') return false;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return false;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (y < 1900 || mo < 1 || mo > 12 || d < 1) return false;
    var leap = (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0));
    var dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return d <= dim[mo - 1];
  }
  function compareDates(a, b) { return a < b ? -1 : (a > b ? 1 : 0); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function todayLocal(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function formatDateDisplay(s) {
    if (!isValidDate(s)) return '';
    return (+s.slice(8, 10)) + ' ' + MONTHS[+s.slice(5, 7) - 1] + ' ' + s.slice(0, 4);
  }

  /* ---------- requirements.json ---------- */
  function fail(key, params) { return { ok: false, error: { key: key, params: params || {} } }; }
  function asBool(v) {
    if (v === true || v === false) return v;
    if (v === 'true') return true;
    if (v === 'false') return false;
    return null;
  }
  function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }

  function parseRequirements(text) {
    if (typeof text !== 'string') return fail('json_invalid');
    text = text.replace(/^\ufeff/, '');
    var data;
    try { data = JSON.parse(text); } catch (e) { return fail('json_invalid'); }
    if (!isObj(data)) return fail('json_structure');
    var t = data.tender;
    if (!isObj(t)) return fail('field_missing', { field: 'tender' });
    if (typeof t.tender_id !== 'string' || t.tender_id.trim() === '') return fail('field_missing', { field: 'tender.tender_id' });
    if (typeof t.submission_deadline !== 'string' || t.submission_deadline.trim() === '') return fail('field_missing', { field: 'tender.submission_deadline' });
    var deadline = t.submission_deadline.trim();
    if (!isValidDate(deadline)) return fail('deadline_invalid', { value: deadline });
    var tender = {
      tender_id: t.tender_id.trim(),
      title: typeof t.title === 'string' ? t.title : '',
      procuring_entity: typeof t.procuring_entity === 'string' ? t.procuring_entity : '',
      bidder: typeof t.bidder === 'string' ? t.bidder : '',
      submission_deadline: deadline
    };
    if (!Array.isArray(data.requirements)) return fail('field_missing', { field: 'requirements' });
    if (data.requirements.length === 0) return fail('req_empty');
    var seen = {}, list = [];
    for (var i = 0; i < data.requirements.length; i++) {
      var r = data.requirements[i];
      var pos = i + 1;
      if (!isObj(r)) return fail('req_field', { index: pos, field: 'requirement' });
      var id = (typeof r.id === 'number') ? String(r.id) : r.id;
      if (typeof id !== 'string' || id.trim() === '') return fail('req_field', { index: pos, field: 'id' });
      id = id.trim();
      if (seen[id]) return fail('req_dup_id', { id: id });
      seen[id] = true;
      var order = (typeof r.order === 'string' && r.order.trim() !== '') ? Number(r.order) : r.order;
      if (typeof order !== 'number' || !isFinite(order)) return fail('req_field', { index: pos, id: id, field: 'order' });
      var mandatory = asBool(r.mandatory);
      if (mandatory === null) return fail('req_field', { index: pos, id: id, field: 'mandatory' });
      var hasExpiry = asBool(r.has_expiry);
      if (hasExpiry === null) return fail('req_field', { index: pos, id: id, field: 'has_expiry' });
      var en = typeof r.title_en === 'string' ? r.title_en.trim() : '';
      var bn = typeof r.title_bn === 'string' ? r.title_bn.trim() : '';
      if (en === '' && bn === '') return fail('req_field', { index: pos, id: id, field: 'title_en' });
      list.push({ id: id, order: order, title_en: en, title_bn: bn, mandatory: mandatory, hasExpiry: hasExpiry, index: i });
    }
    list.sort(function (a, b) { return (a.order - b.order) || (a.index - b.index); });
    return { ok: true, tender: tender, requirements: list };
  }

  function titleFor(req, lang) {
    if (lang === 'bn') return req.title_bn || req.title_en;
    return req.title_en || req.title_bn;
  }

  /* ---------- statuses ---------- */
  function statusOf(req, match, deadline) {
    if (!match || !match.fileId) return req.mandatory ? STATUS.MISSING : STATUS.NOT_PROVIDED;
    if (req.hasExpiry) {
      if (!isValidDate(match.expiry)) return STATUS.EXPIRY_NEEDED;
      if (compareDates(match.expiry, deadline) < 0) return STATUS.EXPIRED;
    }
    return STATUS.OK;
  }
  function computeStatuses(reqs, matches, deadline) {
    return reqs.map(function (r) {
      var s = statusOf(r, matches[r.id], deadline);
      return { id: r.id, status: s, blocking: BLOCKING[s] };
    });
  }
  function blockingList(statuses) {
    return statuses.filter(function (s) { return s.blocking; });
  }

  /* ---------- duplicates (files: [{id, hash}]) ---------- */
  function duplicateGroups(files) {
    var byHash = {}, groupOf = {}, groups = {};
    files.forEach(function (f) {
      if (!f.hash) return;
      (byHash[f.hash] = byHash[f.hash] || []).push(f.id);
    });
    Object.keys(byHash).forEach(function (h) {
      if (byHash[h].length > 1) {
        groups[h] = byHash[h];
        byHash[h].forEach(function (id) { groupOf[id] = h; });
      }
    });
    return { groupOf: groupOf, groups: groups };
  }

  /* ---------- matching (matches: { reqId: {fileId, expiry} }) - never mutated ---------- */
  function canMatch(fileId, reqId, matches, dup) {
    var rid;
    for (rid in matches) {
      if (matches[rid].fileId === fileId && rid !== reqId) return { ok: false, reason: 'used_elsewhere', reqId: rid };
    }
    var g = dup && dup.groupOf[fileId];
    if (g) {
      var others = dup.groups[g];
      for (var i = 0; i < others.length; i++) {
        if (others[i] === fileId) continue;
        for (rid in matches) {
          if (matches[rid].fileId === others[i] && rid !== reqId) return { ok: false, reason: 'duplicate_used', reqId: rid };
        }
      }
    }
    return { ok: true };
  }
  function copyMatches(m) {
    var c = {};
    Object.keys(m).forEach(function (k) { c[k] = { fileId: m[k].fileId, expiry: m[k].expiry }; });
    return c;
  }
  function assign(matches, reqId, fileId, dup) {
    var next = copyMatches(matches);
    if (!fileId) { delete next[reqId]; return { ok: true, matches: next }; }
    var c = canMatch(fileId, reqId, matches, dup);
    if (!c.ok) return { ok: false, reason: c.reason, reqId: c.reqId, matches: matches };
    if (next[reqId] && next[reqId].fileId === fileId) return { ok: true, matches: next };
    next[reqId] = { fileId: fileId, expiry: '' };   /* a new file never inherits an old expiry date */
    return { ok: true, matches: next };
  }
  function setExpiry(matches, reqId, value) {
    var next = copyMatches(matches);
    if (next[reqId]) next[reqId].expiry = value || '';
    return next;
  }
  function removeFile(matches, fileId) {
    var next = {};
    Object.keys(matches).forEach(function (k) {
      if (matches[k].fileId !== fileId) next[k] = { fileId: matches[k].fileId, expiry: matches[k].expiry };
    });
    return next;
  }

  /* ---------- uploads ---------- */
  function checkLimits(files, newSize) {
    var total = 0;
    files.forEach(function (f) { total += f.size; });
    if (files.length + 1 > MAX_FILES) return 'too_many';
    if (total + newSize > MAX_BYTES) return 'too_big';
    return null;
  }
  function looksLikePdf(bytes) {
    var sig = [0x25, 0x50, 0x44, 0x46, 0x2D]; /* %PDF- */
    var limit = Math.min(bytes.length, 1024) - sig.length;
    for (var i = 0; i <= limit; i++) {
      var hit = true;
      for (var j = 0; j < sig.length; j++) { if (bytes[i + j] !== sig[j]) { hit = false; break; } }
      if (hit) return true;
    }
    return false;
  }
  function getSubtle() {
    if (typeof crypto !== 'undefined' && crypto.subtle) return crypto.subtle;
    if (typeof require === 'function') { try { return require('crypto').webcrypto.subtle; } catch (e) { /* ignore */ } }
    return null;
  }
  function sha256Hex(buffer) {
    var subtle = getSubtle();
    if (!subtle) return Promise.reject(new Error('no-subtle-crypto'));
    return subtle.digest('SHA-256', buffer).then(function (h) {
      var b = new Uint8Array(h), s = '';
      for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16);
      return s;
    });
  }

  /* ---------- package ---------- */
  function footerText(tenderId, page, total) { return tenderId + ' | Page ' + page + ' of ' + total; }
  function downloadName(tenderId) {
    return String(tenderId).replace(/[\\\/:*?"<>|\u0000-\u001f]/g, '_').trim() + '_Package.pdf';
  }
  /* files: [{id, name, pages}]. Cover = page 1, so documents start at page 2. */
  function packagePlan(reqs, matches, files) {
    var byId = {};
    files.forEach(function (f) { byId[f.id] = f; });
    var items = [], page = 2;
    reqs.forEach(function (r) {
      var m = matches[r.id];
      if (!m || !byId[m.fileId]) return;
      var f = byId[m.fileId];
      items.push({ req: r, file: f, startPage: page });
      page += f.pages;
    });
    return { items: items, totalPages: page - 1 };
  }
  /* Standard PDF fonts only draw WinAnsi characters; anything else becomes "?" instead of crashing. */
  var WIN_EXTRA = { 0x20AC: 1, 0x201A: 1, 0x0192: 1, 0x201E: 1, 0x2026: 1, 0x2020: 1, 0x2021: 1, 0x02C6: 1, 0x2030: 1,
    0x0160: 1, 0x2039: 1, 0x0152: 1, 0x017D: 1, 0x2018: 1, 0x2019: 1, 0x201C: 1, 0x201D: 1, 0x2022: 1, 0x2013: 1,
    0x2014: 1, 0x02DC: 1, 0x2122: 1, 0x0161: 1, 0x203A: 1, 0x0153: 1, 0x017E: 1, 0x0178: 1 };
  function winAnsiSafe(text) {
    var out = '';
    for (var ch of String(text == null ? '' : text)) {
      var cp = ch.codePointAt(0);
      if (cp === 9 || cp === 10 || cp === 13) out += ' ';
      else if ((cp >= 0x20 && cp <= 0x7E) || (cp >= 0xA0 && cp <= 0xFF) || WIN_EXTRA[cp]) out += ch;
      else out += '?';
    }
    return out;
  }

  return {
    MAX_FILES: MAX_FILES, MAX_BYTES: MAX_BYTES, STATUS: STATUS, STATUS_LABEL_EN: STATUS_LABEL_EN, BLOCKING: BLOCKING,
    isValidDate: isValidDate, compareDates: compareDates, todayLocal: todayLocal, formatDateDisplay: formatDateDisplay,
    parseRequirements: parseRequirements, titleFor: titleFor,
    statusOf: statusOf, computeStatuses: computeStatuses, blockingList: blockingList,
    duplicateGroups: duplicateGroups, canMatch: canMatch, assign: assign, setExpiry: setExpiry, removeFile: removeFile,
    checkLimits: checkLimits, looksLikePdf: looksLikePdf, sha256Hex: sha256Hex,
    footerText: footerText, downloadName: downloadName, packagePlan: packagePlan, winAnsiSafe: winAnsiSafe
  };
});