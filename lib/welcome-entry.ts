// The home route runs this before its first visible element. Qualified links open
// the requested workspace directly, including when storage is unavailable.
export const WELCOME_SEEN_KEY = 'sasa.welcome.entered.v1';

export const WELCOME_ENTRY_SCRIPT = `(function(){
  var params = new URLSearchParams(location.search);
  var replay = params.get('welcome') === '1';
  if (location.hash || params.get('present') === '1') return;
  if (location.search && !replay) return;
  var seen = false;
  try { seen = !!localStorage.getItem('${WELCOME_SEEN_KEY}'); } catch (_) {}
  if (replay || !seen) document.documentElement.dataset.sasaWelcome = 'open';
})();`;
