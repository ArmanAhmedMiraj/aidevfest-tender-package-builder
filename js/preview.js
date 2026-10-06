/* preview.js - adds a floating preview window next to each file's existing "open in new tab" link. Does not change the app's own code or data. */
(function (root) {
  'use strict';
  var S = root.I18n && root.I18n.S;
  if (!S) return;
  Object.assign(S.en, {
      pv_float: 'Floating preview',
      pv_tab: 'Preview in new tab',
      pv_close: 'Close preview',
      pv_open_tab: 'Open in new tab',
      pv_title: 'Preview: {name}'
  });
  Object.assign(S.bn, {
      pv_float: '\u09ab\u09cd\u09b2\u09cb\u099f\u09bf\u0982 \u09aa\u09cd\u09b0\u09bf\u09ad\u09bf\u0989',
      pv_tab: '\u09a8\u09a4\u09c1\u09a8 \u099f\u09cd\u09af\u09be\u09ac\u09c7 \u09aa\u09cd\u09b0\u09bf\u09ad\u09bf\u0989',
      pv_close: '\u09aa\u09cd\u09b0\u09bf\u09ad\u09bf\u0989 \u09ac\u09a8\u09cd\u09a7 \u0995\u09b0\u09c1\u09a8',
      pv_open_tab: '\u09a8\u09a4\u09c1\u09a8 \u099f\u09cd\u09af\u09be\u09ac\u09c7 \u0996\u09c1\u09b2\u09c1\u09a8',
      pv_title: '\u09aa\u09cd\u09b0\u09bf\u09ad\u09bf\u0989: {name}'
  });
  function lang() { return document.documentElement.lang === 'bn' ? 'bn' : 'en'; }
  function t(k, p) { return root.I18n.t(lang(), k, p); }

  var back, win, titleEl, frame, closeBtn, tabLink, lastTrigger = null;

  function build() {
    back = document.createElement('div'); back.className = 'pv-back'; back.hidden = true;
    win = document.createElement('div'); win.className = 'pv-win'; win.setAttribute('role', 'dialog'); win.setAttribute('aria-modal', 'true');
    var bar = document.createElement('div'); bar.className = 'pv-bar';
    titleEl = document.createElement('h2'); titleEl.className = 'pv-title'; titleEl.id = 'pv-title';
    closeBtn = document.createElement('button'); closeBtn.type = 'button'; closeBtn.className = 'pv-close'; closeBtn.textContent = '\u00d7';
    bar.appendChild(titleEl); bar.appendChild(closeBtn);
    frame = document.createElement('iframe'); frame.className = 'pv-frame';
    var foot = document.createElement('div'); foot.className = 'pv-foot';
    tabLink = document.createElement('a'); tabLink.target = '_blank'; tabLink.rel = 'noopener'; tabLink.className = 'pv-tab';
    foot.appendChild(tabLink);
    win.setAttribute('aria-labelledby', 'pv-title');
    win.appendChild(bar); win.appendChild(frame); win.appendChild(foot); back.appendChild(win); document.body.appendChild(back);
    closeBtn.addEventListener('click', close);
    back.addEventListener('mousedown', function (e) { if (e.target === back) close(); });
    document.addEventListener('keydown', function (e) {
      if (back.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'Tab') {                         /* keep keyboard focus inside the window */
        var order = [closeBtn, tabLink], i = order.indexOf(document.activeElement);
        e.preventDefault();
        order[(i + (e.shiftKey ? order.length - 1 : 1)) % order.length].focus();
      }
    });
  }
  function open(url, name, trigger) {
    if (!back) build();
    lastTrigger = trigger || null;
    titleEl.textContent = t('pv_title', { name: name });
    closeBtn.setAttribute('aria-label', t('pv_close')); closeBtn.title = t('pv_close');
    tabLink.textContent = t('pv_open_tab'); tabLink.href = url;
    frame.title = name; frame.src = url;
    back.hidden = false;
    closeBtn.focus();
  }
  function close() {
    if (!back || back.hidden) return;
    back.hidden = true; frame.src = 'about:blank';          /* page and scroll position are untouched */
    if (lastTrigger && document.body.contains(lastTrigger)) { try { lastTrigger.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }

  /* decorate every file row: [Floating preview] [Preview in new tab] [Remove] */
  function decorate() {
    var list = document.getElementById('file-list');
    if (!list) return;
    Array.prototype.forEach.call(list.querySelectorAll('.file'), function (li) {
      var actions = li.querySelector('.file-actions'), link = actions && actions.querySelector('a[href]');
      if (!link) return;
      var btn = actions.querySelector('.pv-float');
      if (!btn) {
        btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn small pv-float';
        btn.addEventListener('click', function () {
          var nm = li.querySelector('.file-name'); open(link.href, nm ? nm.textContent : '', btn);
        });
        actions.insertBefore(btn, link);
      }
      if (btn.textContent !== t('pv_float')) btn.textContent = t('pv_float');
      if (link.textContent !== t('pv_tab')) link.textContent = t('pv_tab');
    });
  }
  function start() {
    var list = document.getElementById('file-list');
    if (!list) return;
    new MutationObserver(decorate).observe(list, { childList: true, subtree: true });
    decorate();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(typeof self !== 'undefined' ? self : this);