import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { gameFlowGuard } from './game-flow.guard';
import { GameStateService } from './game-state.service';
import {
  createCenteredGridPlacement,
  DeckImage,
  GameState,
} from '../models/game.models';

describe('gameFlowGuard', () => {
  let game: GameStateService;
  const parseUrl = vi.fn((url: string) => ({ redirectedTo: url }));

  beforeEach(() => {
    parseUrl.mockClear();
    TestBed.configureTestingModule({
      providers: [
        GameStateService,
        { provide: Router, useValue: { parseUrl } },
      ],
    });
    game = TestBed.inject(GameStateService);
  });

  it('allows play and redirects setup and results while presenting', () => {
    seedReadyDeck(game);
    game.startGame();

    expect(runGuard('/play')).toBe(true);
    expect(runGuard('/setup')).toEqual({ redirectedTo: '/play' });
    expect(runGuard('/results?from=old')).toEqual({ redirectedTo: '/play' });
    expect(parseUrl).toHaveBeenCalledTimes(2);
  });

  function runGuard(url: string): unknown {
    return TestBed.runInInjectionContext(() =>
      gameFlowGuard({} as never, { url } as never),
    );
  }
});

function seedReadyDeck(game: GameStateService): void {
  const deck: readonly DeckImage[] = [
    {
      id: 'first',
      name: 'first.jpg',
      type: 'image/jpeg',
      size: 100,
      lastModified: 1,
      url: 'blob:first',
      width: 1600,
      height: 900,
      gridPlacement: createCenteredGridPlacement(1600, 900),
      correctCells: [1],
    },
  ];
  const current = (game as unknown as { state: () => GameState }).state();
  (
    game as unknown as {
      writableState: { set(value: GameState): void };
    }
  ).writableState.set({ ...current, deck, configurationIndex: 0 });
}
