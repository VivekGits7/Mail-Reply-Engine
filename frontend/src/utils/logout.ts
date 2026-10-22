export const PERSIST_KEY = 'persist:root';

export function logout() {
  localStorage.removeItem(PERSIST_KEY);
  window.location.assign('/login');
}
