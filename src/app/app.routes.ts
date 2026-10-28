import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'camp' },
  { path: 'camp', loadComponent: () => import('./screens/camp').then((m) => m.Camp) },
  { path: 'mine', loadComponent: () => import('./screens/mine').then((m) => m.Mine) },
  { path: 'mine/result', loadComponent: () => import('./screens/mine-result').then((m) => m.MineResult) },
  { path: 'vault', loadComponent: () => import('./screens/vault').then((m) => m.Vault) },
  { path: 'crew', loadComponent: () => import('./screens/crew').then((m) => m.Crew) },
  { path: 'settings', loadComponent: () => import('./screens/settings').then((m) => m.Settings) },
  { path: 'preview', loadComponent: () => import('./screens/preview').then((m) => m.Preview) },
  { path: '**', redirectTo: 'camp' },
];
