export function applyTheme(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  localStorage.setItem('lotisec-theme', theme)
}

export function initialTheme() {
  return localStorage.getItem('lotisec-theme') || 'light'
}
