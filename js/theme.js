/* theme.js - display modes: "Modern 3D" (default) and "High contrast". Only changes how the page looks (CSS), never the data. */
(function (root) {
  'use strict';
  var S = root.I18n && root.I18n.S;
  if (S) {
    Object.assign(S.en, {
      th_label: 'Display mode',
      th_modern: 'Modern 3D',
      th_contrast: 'High contrast',
      nav_1: 'Requirements',
      nav_2: 'PDF files',
      nav_3: 'Match',
      nav_4: 'Package',
      skip: 'Skip to main content'
    });
    Object.assign(S.bn, {
      th_label: '\u09a1\u09bf\u09b8\u09aa\u09cd\u09b2\u09c7 \u09ae\u09cb\u09a1',
      th_modern: '\u0986\u09a7\u09c1\u09a8\u09bf\u0995 \u09a5\u09cd\u09b0\u09bf-\u09a1\u09bf',
      th_contrast: '\u09b9\u09be\u0987 \u0995\u09a8\u099f\u09cd\u09b0\u09be\u09b8\u09cd\u099f',
      nav_1: '\u09aa\u09cd\u09b0\u09af\u09bc\u09cb\u099c\u09a8\u09c0\u09af\u09bc\u09a4\u09be',
      nav_2: '\u09aa\u09bf\u09a1\u09bf\u098f\u09ab \u09ab\u09be\u0987\u09b2',
      nav_3: '\u09ae\u09bf\u09b2\u09be\u09a8\u09cb',
      nav_4: '\u09aa\u09cd\u09af\u09be\u0995\u09c7\u099c',
      skip: '\u09ae\u09c2\u09b2 \u0985\u0982\u09b6\u09c7 \u09af\u09be\u09a8'
    });
  }
  var KEY = 'uitheme', html = document.documentElement;
  function read() { try { var v = root.localStorage.getItem(KEY); return v === 'contrast' ? 'contrast' : 'modern'; } catch (e) { return 'modern'; } }
  function save(v) { try { root.localStorage.setItem(KEY, v); } catch (e) { /* storage blocked: choice just is not remembered */ } }
  function apply(v) {
    html.setAttribute('data-theme', v);
    Array.prototype.forEach.call(document.querySelectorAll('[data-theme-btn]'), function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-theme-btn') === v ? 'true' : 'false');
    });
  }
  apply(read());
  Array.prototype.forEach.call(document.querySelectorAll('[data-theme-btn]'), function (b) {
    b.addEventListener('click', function () { var v = b.getAttribute('data-theme-btn'); save(v); apply(v); });
  });
})(typeof self !== 'undefined' ? self : this);