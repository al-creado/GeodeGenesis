import { Routes } from '@angular/router';
import { requireUnlock } from './services/unlock.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'mine' },
  { path: 'mine', loadComponent: () => import('./screens/mine').then((m) => m.Mine) },
  { path: 'mine/result', loadComponent: () => import('./screens/mine-result').then((m) => m.MineResult) },
  { path: 'daily', canActivate: [requireUnlock('daily')], loadComponent: () => import('./screens/daily').then((m) => m.Daily) },
  { path: 'vault', canActivate: [requireUnlock('vault')], loadComponent: () => import('./screens/vault').then((m) => m.Vault) },
  { path: 'vault/shop', canActivate: [requireUnlock('shop')], loadComponent: () => import('./screens/shop').then((m) => m.Shop) },
  { path: 'crew', canActivate: [requireUnlock('crew')], loadComponent: () => import('./screens/crew').then((m) => m.Crew) },
  { path: 'settings', loadComponent: () => import('./screens/settings').then((m) => m.Settings) },
  { path: 'preview', loadComponent: () => import('./screens/preview').then((m) => m.Preview) },
  { path: 'camp', redirectTo: 'daily' },
  { path: '**', redirectTo: 'mine' },
];
