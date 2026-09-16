import { Routes } from '@angular/router';

import { gameFlowGuard } from './core/game-flow.guard';
import { SetupPage } from './features/setup/setup-page';
import { PlayPage } from './pages/play-page';
import { ResultsPage } from './pages/results-page';

export const routes: Routes = [
  {
    path: 'setup',
    component: SetupPage,
    canActivate: [gameFlowGuard],
    title: 'Setup | Image Bingo',
  },
  {
    path: 'play',
    component: PlayPage,
    canActivate: [gameFlowGuard],
    title: 'Play | Image Bingo',
  },
  {
    path: 'results',
    component: ResultsPage,
    canActivate: [gameFlowGuard],
    title: 'Results | Image Bingo',
  },
  { path: '', pathMatch: 'full', redirectTo: 'setup' },
  { path: '**', redirectTo: 'setup' },
];
