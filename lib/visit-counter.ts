/**
 * Visit counting for the hosted app with GoatCounter, which sets no cookies and stores no
 * personal data.
 *
 * The inline script sets GoatCounter's path before count.js loads, so a screen is recorded
 * as its address plus only the parameters that pick a screen. Mode, theme and selections
 * therefore do not split one screen into many dashboard rows. Tabs and views change through
 * history.replaceState and pushState, which count.js does not see, so the script also counts
 * a change of that path while the page is visible. count.js itself skips localhost, bots and
 * browsers opted out with #toggle-goatcounter.
 */
export const GOATCOUNTER_ENDPOINT = 'https://prucodes.goatcounter.com/count';

export const VISIT_COUNTER_SCRIPT = `(function () {
  var screenParams = ['tab', 'view', 'subview'];
  function countedPath() {
    var params = new URLSearchParams(location.search);
    var kept = new URLSearchParams();
    screenParams.forEach(function (key) {
      var value = params.get(key);
      if (value) kept.set(key, value);
    });
    var query = kept.toString();
    return location.pathname + (query ? '?' + query : '');
  }
  window.goatcounter = { path: countedPath };
  var last = countedPath();
  function screenChanged() {
    var next = countedPath();
    if (next === last) return;
    last = next;
    if (document.visibilityState === 'visible' && window.goatcounter.count) window.goatcounter.count({ path: next });
  }
  ['pushState', 'replaceState'].forEach(function (name) {
    var original = history[name];
    history[name] = function () {
      var result = original.apply(this, arguments);
      screenChanged();
      return result;
    };
  });
  window.addEventListener('popstate', screenChanged);
  var loader = document.createElement('script');
  loader.async = true;
  loader.src = 'https://gc.zgo.at/count.js';
  loader.setAttribute('data-goatcounter', '${GOATCOUNTER_ENDPOINT}');
  document.head.appendChild(loader);
})();`;
