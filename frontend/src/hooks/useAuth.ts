const KEY = 'wfp_auth';

export function isLoggedIn(): boolean {
  return localStorage.getItem(KEY) === 'true';
}

export function login(): void {
  localStorage.setItem(KEY, 'true');
}

export function logout(): void {
  localStorage.removeItem(KEY);
}
