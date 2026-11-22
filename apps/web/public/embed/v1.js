/* Digest widget loader v1. Contract: specs/014-embeddable-widget/contracts/embed-snippet.md */
(function () {
  var self = document.currentScript || document.querySelector('script[src$="/embed/v1.js"]');
  if (!self || !self.src) return;
  var origin = new URL(self.src).origin;
  var TIMEOUT = 10000;
  var SANDBOX =
    'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox';
  var widgets = [];

  function pick(value, allowed, fallback) {
    return allowed.indexOf(value) < 0 ? fallback : value;
  }

  function fallbackFromAttributes(box) {
    var text = box.getAttribute('data-fallback-text');
    var href = box.getAttribute('data-fallback-href');
    if (box.children.length || !text) return;
    var p = document.createElement('p');
    p.textContent = text;
    if (href && /^https:\/\//i.test(href)) {
      var a = document.createElement('a');
      a.href = href;
      a.textContent = href.replace(/^https:\/\/(www\.)?/i, '').replace(/\/$/, '');
      p.appendChild(document.createTextNode(' '));
      p.appendChild(a);
    }
    box.appendChild(p);
  }

  function setup(box) {
    box.setAttribute('data-dw-done', '');
    fallbackFromAttributes(box);
    var project = box.getAttribute('data-project');
    var partner = box.getAttribute('data-partner');
    if (!project || !partner) return;
    var items = parseInt(box.getAttribute('data-items'), 10);
    if (!(items >= 1 && items <= 20)) items = 3;
    var path = [
      pick(box.getAttribute('data-locale'), ['en', 'de', 'tr', 'ru', 'uk'], 'en'),
      encodeURIComponent(project),
      encodeURIComponent(partner),
      pick(box.getAttribute('data-theme'), ['auto', 'light', 'dark'], 'auto') +
        '-' +
        items +
        '-' +
        pick(box.getAttribute('data-subscribe'), ['form', 'link'], 'form'),
    ].join('/');

    var frame = document.createElement('iframe');
    frame.src = origin + '/embed/' + path;
    frame.title = '';
    frame.setAttribute('sandbox', SANDBOX);
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    frame.style.cssText =
      'border:0;width:100%;height:0;visibility:hidden;position:absolute;left:0;top:0';
    if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
    box.appendChild(frame);

    var w = { box: box, frame: frame, shown: false, dead: false };
    w.timer = setTimeout(function () {
      w.dead = true;
      frame.remove();
    }, TIMEOUT);
    widgets.push(w);
  }

  function resize(w, height) {
    w.frame.style.height = Math.max(Math.ceil(height) || 0, 1) + 'px';
  }

  addEventListener('message', function (e) {
    var d = e.data;
    if (e.origin !== origin || !d || typeof d !== 'object' || d.v !== 1) return;
    for (var i = 0; i < widgets.length; i++) {
      var w = widgets[i];
      if (w.dead || e.source !== w.frame.contentWindow) continue;
      if (d.type === 'digest-widget:ready') {
        clearTimeout(w.timer);
        if (typeof d.title === 'string') w.frame.title = d.title;
        if (!w.shown) {
          w.shown = true;
          for (var j = 0; j < w.box.children.length; j++) {
            var el = w.box.children[j];
            if (el !== w.frame) {
              el.hidden = true;
              el.style.display = 'none';
            }
          }
          w.frame.style.visibility = 'visible';
          w.frame.style.position = 'static';
        }
        resize(w, d.height);
      } else if (d.type === 'digest-widget:size' && w.shown) {
        resize(w, d.height);
      }
      return;
    }
  });

  function init() {
    var boxes = document.querySelectorAll('[data-digest-widget]:not([data-dw-done])');
    for (var i = 0; i < boxes.length; i++) setup(boxes[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
