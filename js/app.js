/* app.js - screen logic. All business rules live in logic.js; this file only reads/writes the page. */
(function () {
  'use strict';
  var L = window.Logic;
  var T = window.I18n.t;
  var state = { lang: 'en', tender: null, reqs: [], files: [], matches: {}, messages: [], nextId: 1 };
  var queue = Promise.resolve();

  function $(id) { return document.getElementById(id); }
  function t(key, params) { return T(state.lang, key, params); }

  /* Build elements with textContent only (never innerHTML), so file names or JSON text can never inject markup. */
  function el(tag, props, kids) {
    var e = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (v === false || v == null) return;
      if (k === 'text') e.textContent = v;
      else if (k === 'class') e.className = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  /* ---------- messages ---------- */
  function addMessage(kind, key, params) {
    state.messages.push({ kind: kind, key: key, params: params || {} });
    if (state.messages.length > 30) state.messages.shift();
    renderMessages();
  }
  function renderMessages() {
    var box = $('messages');
    clear(box);
    if (!state.messages.length) return;
    var list = el('ul', { class: 'msg-list' });
    state.messages.forEach(function (m) {
      list.appendChild(el('li', { class: 'msg msg-' + m.kind, text: t(m.key, m.params) }));
    });
    box.appendChild(list);
    box.appendChild(el('button', { type: 'button', class: 'btn small', text: t('btn_clear_messages'), onclick: function () { state.messages = []; renderMessages(); } }));
  }

  /* ---------- helpers ---------- */
  function fileById(id) { for (var i = 0; i < state.files.length; i++) if (state.files[i].id === id) return state.files[i]; return null; }
  function reqById(id) { for (var i = 0; i < state.reqs.length; i++) if (state.reqs[i].id === id) return state.reqs[i]; return null; }
  function reqTitle(r) { return L.titleFor(r, state.lang); }
  function dupInfo() { return L.duplicateGroups(state.files.map(function (f) { return { id: f.id, hash: f.hash }; })); }
  function pagesText(n) { return t(n === 1 ? 'pages_one' : 'pages_other', { n: n }); }
  function statusIcon(s) { return { ok: '\u2714', missing: '\u2716', expired: '\u2716', expiry_needed: '!', not_provided: '\u2013' }[s]; }
  function matchedReqOfFile(fileId) {
    for (var rid in state.matches) if (state.matches[rid].fileId === fileId) return reqById(rid);
    return null;
  }

  /* ---------- static text ---------- */
  function applyStaticText() {
    document.documentElement.lang = state.lang === 'bn' ? 'bn' : 'en';
    document.title = t('app_title');
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n]'), function (n) { n.textContent = t(n.getAttribute('data-i18n')); });
    $('lang-en').setAttribute('aria-pressed', state.lang === 'en' ? 'true' : 'false');
    $('lang-bn').setAttribute('aria-pressed', state.lang === 'bn' ? 'true' : 'false');
  }

  /* ---------- tender details ---------- */
  function renderTender() {
    var box = $('tender-details');
    clear(box);
    if (!state.tender) return;
    var td = state.tender;
    var rows = [['tender_id', td.tender_id], ['tender_title', td.title], ['procuring_entity', td.procuring_entity], ['bidder', td.bidder],
      ['deadline', td.submission_deadline + ' (' + L.formatDateDisplay(td.submission_deadline) + ')']];
    rows.forEach(function (r) { box.appendChild(el('dt', { text: t(r[0]) })); box.appendChild(el('dd', { text: r[1] })); });
  }

  /* ---------- uploaded files ---------- */
  function renderFiles() {
    var list = $('file-list');
    clear(list);
    if (!state.files.length) { list.appendChild(el('li', { class: 'empty', text: t('no_files') })); return; }
    var dup = dupInfo();
    state.files.forEach(function (f) {
      var li = el('li', { class: 'file' });
      var head = el('div', { class: 'file-head' }, [
        el('span', { class: 'file-name', text: f.name }),
        el('span', { class: 'file-pages', text: pagesText(f.pages) })
      ]);
      var g = dup.groupOf[f.id];
      if (g) {
        head.appendChild(el('span', { class: 'badge badge-dup', text: t('duplicate_badge') }));
      }
      var meta = el('div', { class: 'file-meta' });
      if (g) {
        var others = dup.groups[g].filter(function (id) { return id !== f.id; }).map(function (id) { return fileById(id).name; });
        meta.appendChild(el('div', { class: 'dup-note', text: t('duplicate_of', { names: others.join(', ') }) }));
      }
      var r = matchedReqOfFile(f.id);
      meta.appendChild(el('div', { class: r ? 'used' : 'unused', text: r ? t('used_for', { title: reqTitle(r) }) : t('not_matched') }));
      var actions = el('div', { class: 'file-actions' }, [
        el('a', { class: 'btn small', href: f.url, target: '_blank', rel: 'noopener', text: t('btn_preview') }),
        el('button', { type: 'button', class: 'btn small danger', text: t('btn_remove'), onclick: function () { removeFile(f.id); } })
      ]);
      li.appendChild(head); li.appendChild(meta); li.appendChild(actions);
      list.appendChild(li);
    });
  }

  /* ---------- requirements table ---------- */
  function renderTable() {
    var wrap = $('req-wrap');
    clear(wrap);
    if (!state.tender) { wrap.appendChild(el('p', { class: 'empty', text: t('need_json') })); return; }
    var dup = dupInfo();
    var table = el('table', { class: 'req-table' });
    table.appendChild(el('thead', null, [el('tr', null, [
      el('th', { text: t('col_no') }), el('th', { text: t('col_doc') }), el('th', { text: t('col_file') }),
      el('th', { text: t('col_expiry') }), el('th', { text: t('col_status') })])]));
    var tbody = el('tbody');
    state.reqs.forEach(function (r, i) {
      var m = state.matches[r.id];
      var sel = el('select', { 'aria-label': reqTitle(r), onchange: function (ev) { onSelectFile(r.id, ev.target.value, ev.target); } });
      sel.appendChild(el('option', { value: '', text: t('choose_file') }));
      state.files.forEach(function (f) {
        var c = L.canMatch(f.id, r.id, state.matches, dup);
        var label = f.name;
        if (!c.ok) label += ' ' + t(c.reason === 'used_elsewhere' ? 'opt_used' : 'opt_duplicate_used', { title: reqTitle(reqById(c.reqId)) });
        sel.appendChild(el('option', { value: f.id, text: label, disabled: !c.ok }));
      });
      sel.value = m ? m.fileId : '';
      var fileCell = el('td', { class: 'cell-file' }, [sel]);
      if (m) fileCell.appendChild(el('button', { type: 'button', class: 'btn small', text: t('btn_unmatch'), onclick: function () { onSelectFile(r.id, '', null); } }));

      var expCell = el('td', { class: 'cell-expiry' });
      if (!r.hasExpiry) expCell.appendChild(el('span', { class: 'muted', text: t('expiry_none') }));
      else if (!m) expCell.appendChild(el('span', { class: 'muted', text: t('expiry_first') }));
      else {
        var inp = el('input', { type: 'date', min: '1900-01-01', max: '9999-12-31', value: m.expiry || '', 'aria-label': t('col_expiry') + ': ' + reqTitle(r),
          oninput: function (ev) { state.matches = L.setExpiry(state.matches, r.id, ev.target.value); refreshLive(); } });
        expCell.appendChild(inp);
        expCell.appendChild(el('div', { class: 'date-shown', 'data-for': r.id, text: L.formatDateDisplay(m.expiry) }));
      }
      var tr = el('tr', null, [
        el('td', { text: String(i + 1) }),
        el('td', { class: 'cell-doc' }, [el('div', { class: 'doc-title', text: reqTitle(r) }),
          el('span', { class: 'badge ' + (r.mandatory ? 'badge-req' : 'badge-opt'), text: t(r.mandatory ? 'required' : 'optional') })]),
        fileCell, expCell,
        el('td', { class: 'cell-status', 'data-status-for': r.id })
      ]);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    paintStatuses();
  }

  /* Update statuses, date text and the Generate box without rebuilding the table (keeps typing focus). */
  function paintStatuses() {
    if (!state.tender) return;
    var statuses = L.computeStatuses(state.reqs, state.matches, state.tender.submission_deadline);
    statuses.forEach(function (s) {
      var cell = document.querySelector('[data-status-for="' + s.id + '"]');
      if (!cell) return;
      clear(cell);
      cell.appendChild(el('span', { class: 'status st-' + s.status, text: statusIcon(s.status) + ' ' + t('status_' + s.status) }));
    });
    Array.prototype.forEach.call(document.querySelectorAll('.date-shown'), function (n) {
      var m = state.matches[n.getAttribute('data-for')];
      n.textContent = m ? L.formatDateDisplay(m.expiry) : '';
    });
  }
  function renderGenerate() {
    var box = $('gen-reasons'), btn = $('btn-generate');
    clear(box);
    if (!state.tender) {
      btn.disabled = true;
      box.appendChild(el('p', { class: 'blocked', text: t('need_json') }));
      return;
    }
    var statuses = L.computeStatuses(state.reqs, state.matches, state.tender.submission_deadline);
    var blocking = L.blockingList(statuses);
    if (blocking.length) {
      btn.disabled = true;
      box.appendChild(el('p', { class: 'blocked', text: t('blocked_title') }));
      var ul = el('ul', { class: 'blocked-list' });
      blocking.forEach(function (b) {
        ul.appendChild(el('li', { text: t('blocked_item', { title: reqTitle(reqById(b.id)), status: t('status_' + b.status) }) }));
      });
      box.appendChild(ul);
    } else {
      btn.disabled = false;
      var plan = L.packagePlan(state.reqs, state.matches, state.files);
      box.appendChild(el('p', { class: 'ready', text: t('ready') }));
      box.appendChild(el('p', { class: 'muted', text: t('will_have', { n: plan.totalPages }) }));
    }
  }
  function refreshLive() { paintStatuses(); renderGenerate(); }

  function render() {
    applyStaticText();
    renderMessages();
    renderTender();
    renderFiles();
    renderTable();
    renderGenerate();
  }

  /* ---------- actions ---------- */
  function onSelectFile(reqId, fileId, selectNode) {
    var r = L.assign(state.matches, reqId, fileId, dupInfo());
    if (r.ok) state.matches = r.matches;
    render();
  }
  function removeFile(id) {
    var f = fileById(id);
    if (!f) return;
    try { URL.revokeObjectURL(f.url); } catch (e) { /* ignore */ }
    state.files = state.files.filter(function (x) { return x.id !== id; });
    state.matches = L.removeFile(state.matches, id);
    render();
  }

  function loadRequirements(file) {
    return file.text().then(function (text) {
      var p = L.parseRequirements(text);
      if (!p.ok) { addMessage('error', 'err_' + p.error.key, p.error.params); return; }
      var hadMatches = Object.keys(state.matches).length > 0;
      state.tender = p.tender; state.reqs = p.requirements; state.matches = {};
      if (hadMatches) addMessage('info', 'info_reset');
      render();
    }, function () { addMessage('error', 'err_json_invalid'); });
  }

  function addOneFile(file) {
    var name = file.name;
    if (!window.PDFLib) { addMessage('error', 'err_lib'); return Promise.resolve(); }
    var limit = L.checkLimits(state.files, file.size);
    if (limit === 'too_many') { addMessage('error', 'err_too_many', { name: name, max: L.MAX_FILES }); return Promise.resolve(); }
    if (limit === 'too_big') { addMessage('error', 'err_too_big', { name: name }); return Promise.resolve(); }
    return file.arrayBuffer().then(function (buf) {
      var bytes = new Uint8Array(buf);
      if (!L.looksLikePdf(bytes)) { addMessage('error', 'err_not_pdf', { name: name }); return; }
      return window.PDFLib.PDFDocument.load(bytes).then(function (doc) {
        var pages = doc.getPageCount();
        if (pages < 1) { addMessage('error', 'err_no_pages', { name: name }); return; }
        return L.sha256Hex(buf).catch(function () { return null; }).then(function (hash) {
          /* the limit is checked again here because earlier files may have finished in between */
          if (L.checkLimits(state.files, file.size)) { addMessage('error', 'err_too_many', { name: name, max: L.MAX_FILES }); return; }
          var url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
          state.files.push({ id: 'f' + (state.nextId++), name: name, size: file.size, pages: pages, hash: hash, url: url, bytes: bytes });
          render();
        });
      }, function (err) {
        var msg = String(err && err.message || err);
        addMessage('error', /encrypt/i.test(msg) ? 'err_encrypted' : 'err_bad_pdf', { name: name });
      });
    }, function () { addMessage('error', 'err_read', { name: name }); });
  }
  function addFiles(fileList) {
    var arr = Array.prototype.slice.call(fileList || []);
    arr.forEach(function (f) { queue = queue.then(function () { return addOneFile(f); }).catch(function () { addMessage('error', 'err_read', { name: f.name }); }); });
  }

  /* ---------- wiring ---------- */
  function setLang(lang) { state.lang = lang; render(); }
  function init() {
    $('lang-en').addEventListener('click', function () { setLang('en'); });
    $('lang-bn').addEventListener('click', function () { setLang('bn'); });
    $('btn-json').addEventListener('click', function () { $('json-input').click(); });
    $('json-input').addEventListener('change', function (ev) {
      var f = ev.target.files && ev.target.files[0];
      if (f) loadRequirements(f);
      ev.target.value = '';           /* lets the user choose the same file again later */
    });
    $('btn-pdfs').addEventListener('click', function () { $('pdf-input').click(); });
    $('pdf-input').addEventListener('change', function (ev) {
      addFiles(ev.target.files);
      ev.target.value = '';
    });
    var dz = $('dropzone');
    ['dragenter', 'dragover'].forEach(function (n) { dz.addEventListener(n, function (e) { e.preventDefault(); dz.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (n) { dz.addEventListener(n, function (e) { e.preventDefault(); dz.classList.remove('over'); }); });
    dz.addEventListener('drop', function (e) { addFiles(e.dataTransfer && e.dataTransfer.files); });
    /* a file dropped outside the box must not make Chrome open it and leave the app */
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('drop', function (e) { e.preventDefault(); });
    $('btn-generate').addEventListener('click', function () {
      if (window.PackageBuilder && window.PackageBuilder.generate) window.PackageBuilder.generate(state, { addMessage: addMessage, refresh: renderGenerate });
      else addMessage('info', 'info_gen_pending');
    });
    window.AppState = state;        /* read by the package builder and by automated checks */
    render();
  }
  document.addEventListener('DOMContentLoaded', init);
})();