/**
 * Bridge script injected into the WebContainer preview iframe.
 * Captures console events, DOM changes, element clicks, and screenshot requests.
 * Posts all events to the parent window via postMessage.
 *
 * This is exported as a string constant for injection into the iframe.
 */
export const BRIDGE_SCRIPT = `
(function() {
  // === Console monkey-patch ===
  var _origLog = console.log, _origWarn = console.warn, _origError = console.error;
  ['log', 'warn', 'error'].forEach(function(level) {
    var orig = console[level];
    console[level] = function() {
      orig.apply(console, arguments);
      var args = Array.prototype.slice.call(arguments);
      var msg = args.map(function(a) {
        return typeof a === 'string' ? a : JSON.stringify(a);
      }).join(' ').slice(0, 2000);
      window.parent.postMessage({
        type: 'solvent:console',
        level: level,
        message: msg,
        timestamp: Date.now()
      }, '*');
    };
  });

  // === Unhandled errors ===
  window.onerror = function(msg, url, line, col, err) {
    window.parent.postMessage({
      type: 'solvent:error',
      message: String(msg),
      stack: err ? err.stack : undefined,
      timestamp: Date.now()
    }, '*');
  };
  window.addEventListener('unhandledrejection', function(e) {
    window.parent.postMessage({
      type: 'solvent:error',
      message: 'Unhandled Promise Rejection: ' + e.reason,
      timestamp: Date.now()
    }, '*');
  });

  // === DOM change observer ===
  var domHashTimer;
  function emitDomHash() {
    clearTimeout(domHashTimer);
    domHashTimer = setTimeout(function() {
      var body = document.body;
      var html = body.innerHTML.slice(0, 50000);
      var hash = simpleHash(html);
      window.parent.postMessage({
        type: 'solvent:dom-changed',
        hash: hash,
        bodyHTML: html,
        timestamp: Date.now()
      }, '*');
    }, 250);
  }
  var observer = new MutationObserver(emitDomHash);
  observer.observe(document.documentElement, {
    childList: true, subtree: true, attributes: true, characterData: true
  });
  emitDomHash();

  // === Click capture (capture phase) ===
  document.addEventListener('click', function(e) {
    var el = e.target;
    if (!el || el === document) return;
    var rect = el.getBoundingClientRect();
    var dataAttrs = {};
    for (var i = 0; i < el.attributes.length; i++) {
      var attr = el.attributes[i];
      if (attr.name.startsWith('data-')) dataAttrs[attr.name] = attr.value;
    }
    window.parent.postMessage({
      type: 'solvent:click',
      tag: el.tagName.toLowerCase(),
      id: el.id || undefined,
      classes: Array.from(el.classList),
      text: (el.textContent || '').trim().slice(0, 200),
      dataAttrs: dataAttrs,
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
    }, '*');
  }, true);

  // === html2canvas loader (lazy) ===
  var html2canvasPromise = null;
  function loadHtml2Canvas() {
    if (html2canvasPromise) return html2canvasPromise;
    html2canvasPromise = new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return html2canvasPromise;
  }

  // === Screenshot capture listener ===
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'solvent:capture-screenshot') {
      loadHtml2Canvas().then(function() {
        return window.html2canvas(document.body, { useCORS: true, logging: false });
      }).then(function(canvas) {
        var dataUrl = canvas.toDataURL('image/png');
        window.parent.postMessage({ type: 'solvent:screenshot-ready', dataUrl: dataUrl }, '*');
      }).catch(function(err) {
        window.parent.postMessage({ type: 'solvent:screenshot-error', error: err.message }, '*');
      });
    }
  });

  // === Utility ===
  function simpleHash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(36).slice(0, 8);
  }
})();
`;
