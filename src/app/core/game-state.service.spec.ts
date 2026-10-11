import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GameStateService } from './game-state.service';
import {
  createCenteredGridPlacement,
  DeckImage,
  GameState,
} from '../models/game.models';

describe('GameStateService', () => {
  let game: GameStateService;

  beforeEach(() => {
    game = new GameStateService();
  });

  afterEach(() => game.ngOnDestroy());

  it('prepares a game without exposing round one, then begins it exactly once', () => {
    seedReadyDeck(game, [image('first'), image('second')]);

    game.startGame();

    expect(game.phase()).toBe('presentation');
    expect(game.authoritativeRoute()).toBe('/play');
    expect(game.currentImageIndex()).toBeNull();
    expect(game.currentGameImage()).toBeNull();
    expect(game.starter()).toBeNull();

    game.startGame();
    expect(game.phase()).toBe('presentation');

    game.beginGame();
    expect(game.phase()).toBe('guessing-first');
    expect(game.currentImageIndex()).toBe(0);
    expect(game.currentGameImage()?.id).toBe('first');
    expect(game.starter()).toBe('red');

    const round = stateOf(game).round;
    game.beginGame();
    expect(stateOf(game).round).toBe(round);
  });

  it('accepts only whole-number guess limits between one and the cell count', () => {
    expect(game.guessesPerTeam()).toBe(2);

    for (const value of [1, 2, 3, 100]) {
      game.setGuessesPerTeam(value);
      expect(game.guessesPerTeam()).toBe(value);
    }

    for (const value of [0, 101, 2.5, Number.NaN]) {
      game.setGuessesPerTeam(value);
      expect(game.guessesPerTeam()).toBe(100);
    }
  });

  it('uses the configured limit for selection, locking, and reveal readiness', () => {
    seedReadyDeck(game, [image('first')]);
    game.setGuessesPerTeam(3);
    game.startGame();
    game.beginGame();
    game.setGuessesPerTeam(2);
    expect(game.guessesPerTeam()).toBe(3);

    game.toggleGuess(1);
    game.toggleGuess(2);
    expect(game.canLock()).toBe(false);
    game.toggleGuess(3);
    expect(game.canLock()).toBe(true);
    game.toggleGuess(4);
    expect(game.redSelections()).toEqual([1, 2, 3]);
    game.toggleGuess(3);
    expect(game.canLock()).toBe(false);
    game.toggleGuess(3);
    game.lockActiveTeam();

    expect(game.phase()).toBe('guessing-second');
    expect(game.canReveal()).toBe(false);
    game.toggleGuess(4);
    game.toggleGuess(5);
    game.toggleGuess(6);
    game.lockActiveTeam();

    expect(game.phase()).toBe('ready-to-reveal');
    expect(game.canReveal()).toBe(true);
  });

  it('preserves the configured image identity while moving images adjacently', () => {
    seedReadyDeck(game, [image('first'), image('middle'), image('last')], 1);

    game.moveImage('middle', 'earlier');
    expect(game.deck().map(({ id }) => id)).toEqual(['middle', 'first', 'last']);
    expect(game.configurationImage()?.id).toBe('middle');
    expect(game.configurationIndex()).toBe(0);

    game.moveImage('middle', 'later');
    expect(game.deck().map(({ id }) => id)).toEqual(['first', 'middle', 'last']);
    expect(game.configurationImage()?.id).toBe('middle');
    expect(game.configurationIndex()).toBe(1);
  });

  it('ignores invalid, boundary, and non-setup reorder attempts', () => {
    seedReadyDeck(game, [image('first'), image('last')]);
    const original = game.deck();

    game.moveImage('first', 'earlier');
    game.moveImage('last', 'later');
    game.moveImage('missing', 'earlier');
    expect(game.deck()).toBe(original);

    game.startGame();
    const prepared = game.deck();
    game.moveImage('first', 'later');
    expect(game.deck()).toBe(prepared);
  });

  it('preserves names and guess limit when clearing the deck', () => {
    seedReadyDeck(game, [image('first')]);
    game.setGameName('Gallery night');
    game.setTeamName('red', 'Foxes');
    game.setTeamName('blue', 'Owls');
    game.setGuessesPerTeam(3);

    game.clearDeck();

    expect(game.configuredGameName()).toBe('Gallery night');
    expect(game.configuredTeamNames()).toEqual({ red: 'Foxes', blue: 'Owls' });
    expect(game.guessesPerTeam()).toBe(3);
    expect(game.deck()).toEqual([]);
    expect(game.completedRounds()).toEqual([]);
  });

  it('preserves names, deck, and guess limit when returning from results', () => {
    seedReadyDeck(game, [image('first', [1])]);
    game.setGameName('Gallery night');
    game.setTeamName('red', 'Foxes');
    game.setTeamName('blue', 'Owls');
    game.setGuessesPerTeam(1);
    game.startGame();
    game.beginGame();
    game.toggleGuess(1);
    game.lockActiveTeam();
    game.toggleGuess(2);
    game.lockActiveTeam();
    game.reveal();
    game.finishGame();

    game.returnToSetup();

    expect(game.phase()).toBe('setup');
    expect(game.configuredGameName()).toBe('Gallery night');
    expect(game.configuredTeamNames()).toEqual({ red: 'Foxes', blue: 'Owls' });
    expect(game.guessesPerTeam()).toBe(1);
    expect(game.deck().map(({ id }) => id)).toEqual(['first']);
    expect(game.completedRounds()).toEqual([]);
    expect(game.currentImageIndex()).toBeNull();
  });
});

function seedReadyDeck(
  game: GameStateService,
  deck: readonly DeckImage[],
  configurationIndex = 0,
): void {
  const current = stateOf(game);
  setState(game, {
    ...current,
    deck,
    configurationIndex,
  });
}

function stateOf(game: GameStateService): GameState {
  return (game as unknown as { state: () => GameState }).state();
}

function setState(game: GameStateService, state: GameState): void {
  (
    game as unknown as {
      writableState: { set(value: GameState): void };
    }
  ).writableState.set(state);
}

function image(id: string, correctCells: readonly number[] = [1]): DeckImage {
  return {
    id,
    name: `${id}.jpg`,
    type: 'image/jpeg',
    size: 100,
    lastModified: 1,
    url: `blob:${id}`,
    width: 1600,
    height: 900,
    gridPlacement: createCenteredGridPlacement(1600, 900),
    correctCells,
  };
}
