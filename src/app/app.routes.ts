import { Routes } from '@angular/router';
import { requireUnlock } from './services/unlock.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'pulls' },
  { path: 'pulls', loadComponent: () => import('./screens/pulls').then((m) => m.Pulls) },
  { path: 'pulls/result', loadComponent: () => import('./screens/pulls-result').then((m) => m.PullsResult) },
  { path: 'daily', canActivate: [requireUnlock('daily')], loadComponent: () => import('./screens/daily').then((m) => m.Daily) },
  { path: 'vault', canActivate: [requireUnlock('vault')], loadComponent: () => import('./screens/vault').then((m) => m.Vault) },
  { path: 'vault/shop', canActivate: [requireUnlock('shop')], loadComponent: () => import('./screens/shop').then((m) => m.Shop) },
  { path: 'crew', canActivate: [requireUnlock('crew')], loadComponent: () => import('./screens/crew').then((m) => m.Crew) },
  { path: 'settings', loadComponent: () => import('./screens/settings').then((m) => m.Settings) },
  { path: 'preview', loadComponent: () => import('./screens/preview').then((m) => m.Preview) },
  { path: 'camp', redirectTo: 'daily' },
  { path: '**', redirectTo: 'pulls' },
];
