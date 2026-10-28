import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'preview' },
  { path: 'preview', loadComponent: () => import('./screens/preview').then((m) => m.Preview) },
];
