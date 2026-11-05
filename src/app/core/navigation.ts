/** What the Android back button should do. Pure so it can be tested without a device. */
export type BackAction =
  | { readonly type: 'closeOverlay' }
  | { readonly type: 'navigate'; readonly to: string }
  | { readonly type: 'history' }
  | { readonly type: 'exit' };

const TABS = ['/mine', '/vault', '/crew', '/daily'];

export function decideBack(url: string, overlayOpen: boolean): BackAction {
  if (overlayOpen) return { type: 'closeOverlay' };
  const path = url.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (path === '/mine/result') return { type: 'navigate', to: '/mine' };
  if (path === '/vault/shop') return { type: 'navigate', to: '/vault' };
  if (path === '/settings' || path === '/preview') return { type: 'history' };
  if (TABS.includes(path) && path !== '/mine') return { type: 'navigate', to: '/mine' };
  return { type: 'exit' }; // Mine (the home tab) or unknown: leave the app
}
