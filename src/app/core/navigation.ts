/** What the Android back button should do. Pure so it can be tested without a device. */
export type BackAction =
  | { readonly type: 'closeOverlay' }
  | { readonly type: 'navigate'; readonly to: string }
  | { readonly type: 'history' }
  | { readonly type: 'exit' };

const TABS = ['/pulls', '/vault', '/crew', '/daily'];

export function decideBack(url: string, overlayOpen: boolean): BackAction {
  if (overlayOpen) return { type: 'closeOverlay' };
  const path = url.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (path === '/pulls/result') return { type: 'navigate', to: '/pulls' };
  if (path === '/vault/shop') return { type: 'navigate', to: '/vault' };
  if (path === '/settings' || path === '/preview') return { type: 'history' };
  if (TABS.includes(path) && path !== '/pulls') return { type: 'navigate', to: '/pulls' };
  return { type: 'exit' }; // Pulls (the home tab) or unknown: leave the app
}
