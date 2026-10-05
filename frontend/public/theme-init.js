// Applies the saved theme before first paint (no flash of the wrong theme).
// A separate file rather than an inline script, so the Content-Security-Policy can forbid inline JS.
try {
  var saved = localStorage.getItem('xt-theme')
  var dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  if (dark) document.documentElement.classList.add('dark')
} catch (e) {
  // storage unavailable — keep the default light theme
}
