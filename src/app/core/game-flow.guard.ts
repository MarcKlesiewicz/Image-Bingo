import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { GameStateService } from './game-state.service';

export const gameFlowGuard: CanActivateFn = (_route, routerState) => {
  const game = inject(GameStateService);
  const router = inject(Router);
  const requestedPath = routerState.url.split(/[?#]/, 1)[0];
  const authoritativePath = game.authoritativeRoute();

  return requestedPath === authoritativePath ? true : router.parseUrl(authoritativePath);
};
