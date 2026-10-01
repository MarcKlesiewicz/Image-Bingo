import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GameStateService } from '../../core/game-state.service';
import {
  ActiveGameState,
  createCenteredGridPlacement,
  DeckImage,
  GameState,
  RoundSelection,
} from '../../models/game.models';
import { GamePage } from './game-page';

describe('GamePage', () => {
  let fixture: ComponentFixture<GamePage>;
  let game: GameStateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GamePage],
      providers: [
        GameStateService,
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();

    game = TestBed.inject(GameStateService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the first image private on the presentation screen and begins once', () => {
    setState(game, presentationState());
    render();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.presentation-screen')?.textContent).toContain(
      'Friday Picture Party',
    );
    const matchup = host.querySelector('.presentation-matchup');
    expect(matchup?.querySelector('.red-team')?.textContent?.trim()).toBe('Scarlet');
    expect(matchup?.querySelector('span')?.textContent?.trim()).toBe('vs');
    expect(matchup?.querySelector('.blue-team')?.textContent?.trim()).toBe('Cobalt');
    expect(host.querySelector('app-scoreboard')).toBeNull();
    expect(host.querySelector('app-image-grid')).toBeNull();
    expect(host.textContent).not.toContain('secret-first-image.jpg');

    host.querySelector<HTMLButtonElement>('.start-game-action')?.click();
    fixture.detectChanges();

    expect(game.phase()).toBe('guessing-first');
    expect(game.currentGameImage()?.name).toBe('secret-first-image.jpg');
    expect(host.querySelector('.presentation-screen')).toBeNull();
    expect(host.querySelector('app-image-grid')).not.toBeNull();
  });

  it('renders all guess-dependent copy from the configured per-team limit', () => {
    setState(
      game,
      activeState({
        guessesPerTeam: 3,
        round: round({ red: [1, 2], blue: [] }),
      }),
    );
    render();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('2/3 selected');
    expect(text).toContain('2 of 3 selected');
    expect(text).toContain('Select 1 more cell');
    expect(text).not.toContain('two guesses');
  });

  it('uses singular guess copy and totals both teams locked guesses', () => {
    setState(
      game,
      activeState({
        guessesPerTeam: 1,
        round: round({ red: [1], blue: [] }),
      }),
    );
    render();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Scarlet has 1 guess.',
    );

    fixture.destroy();
    setState(game, readyState(3));
    render();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      '6 guesses locked',
    );
  });

  it('does not render the image number or filename metadata strip', () => {
    setState(game, activeState());
    render();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.board-meta')).toBeNull();
    expect(host.querySelector('.board-panel')?.textContent).not.toContain(
      'secret-first-image.jpg',
    );
  });

  it('counts down 3, 2, 1, 0 and reveals after zero is shown', async () => {
    vi.useFakeTimers();
    setState(game, readyState());
    const reveal = vi.spyOn(game, 'reveal');
    render();

    const button = revealButton();
    button.click();
    fixture.detectChanges();
    expect(button.textContent?.trim()).toBe('3');
    expect(button.disabled).toBe(true);
    expect(reveal).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);
    fixture.detectChanges();
    expect(button.textContent?.trim()).toBe('2');
    expect(reveal).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);
    fixture.detectChanges();
    expect(button.textContent?.trim()).toBe('1');
    expect(reveal).not.toHaveBeenCalled();

    vi.advanceTimersByTime(999);
    expect(reveal).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    fixture.detectChanges();

    expect(button.textContent?.trim()).toBe('0');
    expect(button.disabled).toBe(true);
    expect(game.phase()).toBe('ready-to-reveal');
    expect(game.completedRounds()).toHaveLength(0);
    expect(reveal).not.toHaveBeenCalled();

    await vi.advanceTimersToNextTimerAsync();
    fixture.detectChanges();

    expect(reveal).toHaveBeenCalledTimes(1);
    expect(game.phase()).toBe('revealed');

    setState(game, readyState());
    fixture.detectChanges();
    expect(revealButton().disabled).toBe(false);
    expect(revealButton().textContent?.trim()).toBe('Reveal image');
  });

  it('ignores repeated reveal activation while a countdown is running', async () => {
    vi.useFakeTimers();
    setState(game, readyState());
    const reveal = vi.spyOn(game, 'reveal');
    render();

    const button = revealButton();
    button.click();
    button.click();
    vi.advanceTimersByTime(3_000);
    await vi.advanceTimersToNextTimerAsync();

    expect(reveal).toHaveBeenCalledTimes(1);
  });

  it('cancels the pending reveal frame when the game is no longer revealable', async () => {
    vi.useFakeTimers();
    setState(game, readyState());
    const reveal = vi.spyOn(game, 'reveal');
    render();

    revealButton().click();
    vi.advanceTimersByTime(3_000);
    fixture.detectChanges();
    expect(revealButton().textContent?.trim()).toBe('0');

    setState(game, presentationState());
    await vi.advanceTimersToNextTimerAsync();

    expect(reveal).not.toHaveBeenCalled();
    expect(game.phase()).toBe('presentation');
  });

  it('cancels a pending reveal when the page is destroyed', async () => {
    vi.useFakeTimers();
    setState(game, readyState());
    const reveal = vi.spyOn(game, 'reveal');
    render();

    revealButton().click();
    vi.advanceTimersByTime(3_000);
    fixture.destroy();
    await vi.runOnlyPendingTimersAsync();

    expect(reveal).not.toHaveBeenCalled();
    expect(game.phase()).toBe('ready-to-reveal');
  });

  function render(): void {
    fixture = TestBed.createComponent(GamePage);
    fixture.detectChanges();
  }

  function revealButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.reveal-action')!;
  }
});

function setState(game: GameStateService, state: GameState): void {
  (
    game as unknown as {
      writableState: { set(value: GameState): void };
    }
  ).writableState.set(state);
}

function presentationState(): GameState {
  return {
    ...sharedState(),
    phase: 'presentation',
    currentImageIndex: null,
    round: null,
  };
}

function activeState(
  overrides: Partial<ActiveGameState> = {},
): ActiveGameState {
  return {
    ...sharedState(),
    phase: 'guessing-first',
    currentImageIndex: 0,
    round: round(),
    ...overrides,
  };
}

function readyState(guessesPerTeam = 2): ActiveGameState {
  return {
    ...sharedState(),
    guessesPerTeam,
    phase: 'ready-to-reveal',
    currentImageIndex: 0,
    round: round(
      {
        red: Array.from({ length: guessesPerTeam }, (_, index) => index + 1),
        blue: Array.from({ length: guessesPerTeam }, (_, index) => index + 51),
      },
      { red: true, blue: true },
    ),
  };
}

function sharedState() {
  return {
    gameName: 'Friday Picture Party',
    teamNames: { red: 'Scarlet', blue: 'Cobalt' },
    guessesPerTeam: 2,
    deck: [image()],
    configurationIndex: 0,
    importPending: false,
    importErrors: [],
    importSummary: null,
    completedRounds: [],
  } as const;
}

function round(
  selections: RoundSelection['selections'] = { red: [], blue: [] },
  locks: RoundSelection['locks'] = { red: false, blue: false },
): RoundSelection {
  return {
    imageId: 'image-1',
    starter: 'red',
    selections,
    locks,
  };
}

function image(): DeckImage {
  return {
    id: 'image-1',
    name: 'secret-first-image.jpg',
    type: 'image/jpeg',
    size: 100,
    lastModified: 1,
    url: 'blob:secret-first-image',
    width: 1600,
    height: 900,
    gridPlacement: createCenteredGridPlacement(1600, 900),
    correctCells: [1, 3],
  };
}
