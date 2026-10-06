/* pdf.js - builds the final package with pdf-lib. Page order, page numbers and file name come from logic.js. */
(function (root) {
  'use strict';
  var isNode = (typeof module !== 'undefined' && module.exports);
  var P = isNode ? global.PDFLib : root.PDFLib;
  var L = isNode ? require('./logic.js') : root.Logic;
  var FOOT = 36;                 /* white band added under every page, so the footer never covers content */
  var A4W = 595.28, A4H = 841.89;

  function safe(s) { return L.winAnsiSafe(s); }

  function wrapText(font, size, text, maxW) {
    var words = safe(text).split(' '), lines = [], cur = '';
    function w(s) { return font.widthOfTextAtSize(s, size); }
    words.forEach(function (word) {
      while (w(word) > maxW && word.length > 1) {          /* a single very long word is cut by characters */
        var cut = word.length - 1;
        while (cut > 1 && w(word.slice(0, cut)) > maxW) cut--;
        if (cur) { lines.push(cur); cur = ''; }
        lines.push(word.slice(0, cut)); word = word.slice(cut);
      }
      var next = cur ? cur + ' ' + word : word;
      if (w(next) <= maxW || !cur) cur = next; else { lines.push(cur); cur = word; }
    });
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  }
  function fitLine(font, size, text, maxW) {
    var s = safe(text);
    if (font.widthOfTextAtSize(s, size) <= maxW) return s;
    while (s.length > 1 && font.widthOfTextAtSize(s + '...', size) > maxW) s = s.slice(0, -1);
    return s + '...';
  }

  function drawFooter(page, font, text) {
    var size = 10, s = safe(text), w = page.getWidth();
    page.drawText(s, { x: (w - font.widthOfTextAtSize(s, size)) / 2, y: 14, size: size, font: font, color: P.rgb(0, 0, 0) });
  }

  function drawCover(out, fonts, tender, plan, madeOn) {
    var page = out.addPage([A4W, A4H]);
    var M = 50, y = A4H - 70, ink = P.rgb(0.1, 0.12, 0.16), grey = P.rgb(0.35, 0.38, 0.42);
    page.drawText('TENDER DOCUMENT PACKAGE', { x: M, y: y, size: 12, font: fonts.bold, color: grey });
    y -= 30;
    wrapText(fonts.bold, 22, tender.title || tender.tender_id, A4W - 2 * M).slice(0, 3).forEach(function (line) {
      page.drawText(line, { x: M, y: y, size: 22, font: fonts.bold, color: ink }); y -= 28;
    });
    y -= 6;
    page.drawLine({ start: { x: M, y: y }, end: { x: A4W - M, y: y }, thickness: 1, color: P.rgb(0.7, 0.72, 0.76) });
    y -= 24;
    var rows = [['Tender ID', tender.tender_id], ['Tender title', tender.title], ['Procuring entity', tender.procuring_entity],
      ['Bidder', tender.bidder], ['Submission deadline', tender.submission_deadline], ['Package made on', madeOn]];
    rows.forEach(function (r) {
      page.drawText(safe(r[0]), { x: M, y: y, size: 10, font: fonts.bold, color: grey });
      wrapText(fonts.regular, 12, r[1] || '-', A4W - 2 * M - 140).slice(0, 3).forEach(function (line) {
        page.drawText(line, { x: M + 140, y: y, size: 12, font: fonts.regular, color: ink }); y -= 16;
      });
      y -= 4;
    });
    y -= 10;
    page.drawText('Included documents (in package order)', { x: M, y: y, size: 13, font: fonts.bold, color: ink });
    y -= 8;
    page.drawLine({ start: { x: M, y: y }, end: { x: A4W - M, y: y }, thickness: 0.5, color: P.rgb(0.7, 0.72, 0.76) });
    y -= 6;
    var bottom = FOOT + 24, items = plan.items, avail = y - bottom;
    var step = Math.min(20, avail / Math.max(items.length, 1));
    var shown = items.length;
    if (step < 9) { shown = Math.max(1, Math.floor(avail / 9) - 1); step = 9; }
    var size = Math.max(7, Math.min(12, step - 5));
    for (var i = 0; i < shown; i++) {
      y -= step;
      var it = items[i];
      var right = 'Page ' + it.startPage, rw = fonts.regular.widthOfTextAtSize(right, size);
      var title = fitLine(fonts.regular, size, (i + 1) + '.  ' + (it.req.title_en || it.req.title_bn), A4W - 2 * M - rw - 16);
      page.drawText(title, { x: M, y: y, size: size, font: fonts.regular, color: ink });
      page.drawText(right, { x: A4W - M - rw, y: y, size: size, font: fonts.regular, color: ink });
    }
    if (shown < items.length) {
      y -= step;
      page.drawText('... and ' + (items.length - shown) + ' more documents', { x: M, y: y, size: size, font: fonts.regular, color: grey });
    }
    return page;
  }

  /* files in state carry {id, name, pages, bytes}; returns Promise<Uint8Array> */
  function build(state, options) {
    var tender = state.tender;
    var plan = L.packagePlan(state.reqs, state.matches, state.files);
    var total = plan.totalPages;
    var byId = {};
    state.files.forEach(function (f) { byId[f.id] = f; });
    var out, fonts, pageNo = 0;
    return P.PDFDocument.create().then(function (doc) {
      out = doc;
      return Promise.all([out.embedFont(P.StandardFonts.Helvetica), out.embedFont(P.StandardFonts.HelveticaBold)]);
    }).then(function (f) {
      fonts = { regular: f[0], bold: f[1] };
      var madeOn = (options && options.madeOn) || L.todayLocal();
      var cover = drawCover(out, fonts, tender, plan, madeOn);
      pageNo = 1;
      drawFooter(cover, fonts.regular, L.footerText(tender.tender_id, pageNo, total));
      var chain = Promise.resolve();
      plan.items.forEach(function (item) {
        chain = chain.then(function () {
          var file = byId[item.file.id];
          return P.PDFDocument.load(file.bytes).then(function (src) {
            var srcPages = src.getPages();
            /* use each page's visible box (CropBox, else MediaBox) so offset or cropped pages land in the right place */
            var boxes = srcPages.map(function (pg) { var b = pg.getCropBox(); return { left: b.x, bottom: b.y, right: b.x + b.width, top: b.y + b.height }; });
            return out.embedPages(srcPages, boxes).then(function (embedded) {
              embedded.forEach(function (emb, i) {
                var rot = ((src.getPage(i).getRotation().angle % 360) + 360) % 360;
                var w = emb.width, h = emb.height, pw = w, ph = h, ox = 0, oy = 0, rotate = 0;
                if (rot === 90) { pw = h; ph = w; oy = w; rotate = -90; }
                else if (rot === 180) { ox = w; oy = h; rotate = -180; }
                else if (rot === 270) { pw = h; ph = w; ox = h; rotate = -270; }
                var page = out.addPage([pw, ph + FOOT]);
                page.drawPage(emb, { x: ox, y: oy + FOOT, rotate: P.degrees(rotate) });
                pageNo++;
                drawFooter(page, fonts.regular, L.footerText(tender.tender_id, pageNo, total));
              });
            });
          });
        });
      });
      return chain;
    }).then(function () {
      out.setTitle(tender.tender_id + ' Package');
      out.setCreator('Tender Document Package Builder');
      out.setProducer('Tender Document Package Builder (pdf-lib)');
      return out.save();
    }).then(function (bytes) {
      /* self-check: re-open the result and confirm the page count the footers promised */
      return P.PDFDocument.load(bytes).then(function (check) {
        if (check.getPageCount() !== total) throw new Error('Page count mismatch: expected ' + total + ' but made ' + check.getPageCount());
        return bytes;
      });
    });
  }

  /* ctx: { addMessage(kind, key, params), refresh() } supplied by app.js */
  function generate(state, ctx) {
    var btn = document.getElementById('btn-generate');
    var statuses = L.computeStatuses(state.reqs, state.matches, state.tender.submission_deadline);
    if (L.blockingList(statuses).length) { ctx.refresh(); return Promise.resolve(); }
    btn.disabled = true;
    return build(state).then(function (bytes) {
      var name = L.downloadName(state.tender.tender_id);
      var url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      var a = document.createElement('a');
      a.href = url; a.download = name; a.style.display = 'none';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      ctx.addMessage('info', 'info_gen_done', { name: name });
    }).catch(function (e) {
      ctx.addMessage('error', 'err_gen_failed', { detail: String(e && e.message || e) });
    }).then(function () { ctx.refresh(); });
  }

  var api = { build: build, generate: generate, FOOTER_HEIGHT: FOOT };
  if (isNode) module.exports = api; else root.PackageBuilder = api;
})(typeof self !== 'undefined' ? self : this);