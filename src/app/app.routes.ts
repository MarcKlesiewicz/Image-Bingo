import { Routes } from '@angular/router';

import { PlayPage } from './pages/play-page';
import { ResultsPage } from './pages/results-page';
import { SetupPage } from './pages/setup-page';

export const routes: Routes = [
  { path: 'setup', component: SetupPage, title: 'Setup | Image Bingo' },
  { path: 'play', component: PlayPage, title: 'Play | Image Bingo' },
  { path: 'results', component: ResultsPage, title: 'Results | Image Bingo' },
  { path: '', pathMatch: 'full', redirectTo: 'setup' },
  { path: '**', redirectTo: 'setup' },
];
