import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GameStateService } from '../../core/game-state.service';
import {
  createCenteredGridPlacement,
  DeckImage,
  GameState,
} from '../../models/game.models';
import { SetupPage } from './setup-page';

describe('SetupPage', () => {
  let fixture: ComponentFixture<SetupPage>;
  let game: GameStateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SetupPage],
      providers: [
        GameStateService,
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();

    game = TestBed.inject(GameStateService);
  });

  it('moves a focused row with arrow keys while preserving focus and configuration identity', async () => {
    seedDeck(game, [image('first'), image('middle'), image('last')], 1);
    createFixture();
    const middle = row('middle');
    middle.focus();

    middle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(game.deck().map(({ id }) => id)).toEqual(['middle', 'first', 'last']);
    expect(game.configurationImage()?.id).toBe('middle');
    expect(document.activeElement).toBe(row('middle'));
    expect(liveReorderStatus()).toContain('middle.jpg moved to round 1 of 3');

    row('middle').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(game.deck().map(({ id }) => id)).toEqual(['first', 'middle', 'last']);
    expect(document.activeElement).toBe(row('middle'));
  });

  it('does not reorder at boundaries or from nested controls and ignores unrelated keys', () => {
    seedDeck(game, [image('first'), image('last')]);
    createFixture();

    row('first').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
    );
    row('first').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const configureButton = row('first').querySelector<HTMLButtonElement>('.small-button')!;
    configureButton.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );

    expect(game.deck().map(({ id }) => id)).toEqual(['first', 'last']);
  });

  it('offers labeled earlier and later icon buttons with disabled boundary actions', async () => {
    seedDeck(game, [image('first'), image('middle'), image('last')]);
    createFixture();

    expect(moveButton('first', 'earlier').disabled).toBe(true);
    expect(moveButton('first', 'later').disabled).toBe(false);
    expect(moveButton('last', 'later').disabled).toBe(true);
    expect(moveButton('middle', 'earlier').getAttribute('aria-label')).toBe(
      'Move middle.jpg one position earlier',
    );
    expect(moveButton('middle', 'earlier').querySelector('fa-icon')).not.toBeNull();

    moveButton('middle', 'later').click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(game.deck().map(({ id }) => id)).toEqual(['first', 'last', 'middle']);
    expect(document.activeElement).toBe(row('middle'));
  });

  it.each([1, 2, 3, 100])('stores the valid guess limit %i for each team', (value) => {
    createFixture();
    const input = guessesInput();

    input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(game.guessesPerTeam()).toBe(value);
    expect(input.getAttribute('min')).toBe('1');
    expect(input.getAttribute('max')).toBe('100');
    expect(input.getAttribute('step')).toBe('1');
    expect(input.getAttribute('aria-invalid')).toBe('false');
    expect(input.getAttribute('aria-describedby')).toBeNull();
  });

  it.each(['', '0', '101', '2.5'])(
    'rejects invalid guess input %j without corrupting the last valid state',
    (value) => {
      createFixture();
      const input = guessesInput();

      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();

      expect(game.guessesPerTeam()).toBe(2);
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(input.getAttribute('aria-describedby')).toBe('guesses-error');
      expect(fixture.nativeElement.querySelector('#guesses-error').textContent).toContain(
        'whole number from 1 to 100',
      );
    },
  );

  it.each(['', '0', '101', '2.5'])(
    'blocks starting with invalid guess input %j even when the deck is complete',
    (value) => {
      seedDeck(game, [image('first')]);
      createFixture();
      const router = TestBed.inject(Router) as unknown as {
        navigate: ReturnType<typeof vi.fn>;
      };

      const input = guessesInput();
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();

      expect(game.canStart()).toBe(true);
      expect(readinessState().textContent).toContain('Setup incomplete');
      expect(startButton().getAttribute('aria-disabled')).toBe('true');
      expect(startGuidance()).toContain('Enter a whole number from 1 to 100.');

      startButton().click();
      fixture.detectChanges();

      expect(game.phase()).toBe('setup');
      expect(router.navigate).not.toHaveBeenCalled();
    },
  );

  it('restores setup readiness and starts after invalid guess input is corrected', () => {
    seedDeck(game, [image('first')]);
    createFixture();
    const router = TestBed.inject(Router) as unknown as {
      navigate: ReturnType<typeof vi.fn>;
    };
    const input = guessesInput();

    input.value = '2.5';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(startButton().getAttribute('aria-disabled')).toBe('true');

    input.value = '3';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(game.guessesPerTeam()).toBe(3);
    expect(readinessState().textContent).toContain('Deck ready');
    expect(startButton().getAttribute('aria-disabled')).toBe('false');
    expect(startGuidance()).toContain('The deck is ready');

    startButton().click();

    expect(game.phase()).toBe('presentation');
    expect(router.navigate).toHaveBeenCalledWith(['/play']);
  });

  it('uses Font Awesome icons without exposing icon glyphs as button names', () => {
    seedDeck(game, [image('first'), image('last')]);
    createFixture();

    const host = fixture.nativeElement as HTMLElement;
    const iconButtons = Array.from(
      host.querySelectorAll<HTMLButtonElement>('.icon-button'),
    );
    expect(iconButtons.length).toBeGreaterThan(0);
    for (const button of iconButtons) {
      expect(button.getAttribute('aria-label')).toBeTruthy();
      expect(button.querySelector('fa-icon')).not.toBeNull();
      expect(button.querySelector('fa-icon')?.getAttribute('aria-hidden')).toBe('true');
    }
  });

  function createFixture(): void {
    fixture = TestBed.createComponent(SetupPage);
    fixture.detectChanges();
  }

  function row(id: string): HTMLElement {
    return fixture.nativeElement.querySelector(`[data-image-id="${id}"]`)!;
  }

  function moveButton(id: string, direction: 'earlier' | 'later'): HTMLButtonElement {
    return row(id).querySelector(`[data-move-direction="${direction}"]`)!;
  }

  function guessesInput(): HTMLInputElement {
    return fixture.nativeElement.querySelector('#guesses-per-team')!;
  }

  function readinessState(): HTMLElement {
    return fixture.nativeElement.querySelector('.readiness-state')!;
  }

  function startButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.start-button')!;
  }

  function startGuidance(): string {
    return fixture.nativeElement.querySelector('#start-guidance').textContent.trim();
  }

  function liveReorderStatus(): string {
    return fixture.nativeElement.querySelector('#deck-order-status').textContent.trim();
  }
});

function seedDeck(
  game: GameStateService,
  deck: readonly DeckImage[],
  configurationIndex = 0,
): void {
  const state = stateOf(game);
  setState(game, { ...state, deck, configurationIndex });
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

function image(id: string): DeckImage {
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
    correctCells: [1],
  };
}
