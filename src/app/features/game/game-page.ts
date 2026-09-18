import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';

import { GameStateService } from '../../core/game-state.service';
import {
  CELL_NUMBERS,
  CellNumber,
  GamePhase,
  MAX_GUESSES,
  Team,
} from '../../models/game.models';
import {
  ImageGrid,
  ImageGridCellView,
  ImageGridOwnership,
  ImageGridRevealOutcome,
} from '../../shared/image-grid/image-grid';
import { Scoreboard } from '../../shared/scoreboard/scoreboard';

const RESULT_LABELS: Record<Exclude<ImageGridRevealOutcome, null>, string> = {
  hit: 'Hit. This guessed cell is correct',
  miss: 'Miss. This guessed cell is not correct',
  'correct-unselected': 'Correct cell, but neither team guessed it',
};

interface CellDescriptionContext {
  readonly ownership: ImageGridOwnership;
  readonly activeTeam: Team | null;
  readonly selectedByActive: boolean;
  readonly disabled: boolean;
  readonly revealOutcome: ImageGridRevealOutcome;
  readonly phase: GamePhase;
}

@Component({
  selector: 'app-game-page',
  imports: [ImageGrid, Scoreboard],
  templateUrl: './game-page.html',
  styleUrl: './game-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GamePage {
  protected readonly game = inject(GameStateService);
  private readonly router = inject(Router);

  private readonly imageGrid = viewChild(ImageGrid);
  private readonly roundHeading =
    viewChild<ElementRef<HTMLHeadingElement>>('roundHeading');
  private readonly revealButton =
    viewChild<ElementRef<HTMLButtonElement>>('revealButton');
  private readonly resultHeading =
    viewChild<ElementRef<HTMLHeadingElement>>('resultHeading');
  private readonly announcement = signal('');

  protected readonly liveAnnouncement = this.announcement.asReadonly();
  private readonly correctCells = computed(
    () => new Set(this.game.currentGameImage()?.correctCells ?? []),
  );
  protected readonly roundNumber = computed(
    () => (this.game.currentImageIndex() ?? 0) + 1,
  );
  protected readonly totalRounds = computed(() => this.game.deck().length);
  protected readonly scoreboardStarter = computed<Team>(
    () => this.game.starter() ?? 'red',
  );
  protected readonly activeTeamLabel = computed(() => {
    const team = this.game.activeTeam();
    return team === null ? '' : this.teamLabel(team);
  });
  protected readonly turnTitle = computed(() => {
    const team = this.game.activeTeam();
    if (team !== null) {
      return `${this.teamLabel(team)} team chooses`;
    }
    if (this.game.phase() === 'ready-to-reveal') {
      return 'Both teams are locked';
    }
    return 'Round revealed';
  });
  protected readonly turnGuidance = computed(() => {
    const team = this.game.activeTeam();
    if (team !== null) {
      const remaining = this.game.remainingGuesses();
      if (remaining === 0) {
        return `${this.teamLabel(team)} has two guesses. Deselect a chosen cell to replace it, or lock the turn.`;
      }
      return `Select ${remaining} more ${remaining === 1 ? 'cell' : 'cells'} for ${this.teamLabel(team)}. Guesses stay editable until Lock guesses.`;
    }
    if (this.game.phase() === 'ready-to-reveal') {
      return 'The board is frozen. Reveal scores the round and uncovers the whole image.';
    }
    return 'Review both teams’ hits and misses, then continue when the room is ready.';
  });
  protected readonly gridCells = computed<readonly ImageGridCellView[]>(() => {
    const red = new Set(this.game.redSelections());
    const blue = new Set(this.game.blueSelections());
    const activeTeam = this.game.activeTeam();
    const activeSelections = new Set(this.game.activeSelections());
    const activeAtLimit = this.game.remainingGuesses() === 0;
    const phase = this.game.phase();
    const correct = this.correctCells();
    const acceptingGuesses = phase === 'guessing-first' || phase === 'guessing-second';

    return CELL_NUMBERS.map((number) => {
      const redSelected = red.has(number);
      const blueSelected = blue.has(number);
      const ownership = this.ownership(redSelected, blueSelected);
      const selectedByActive = activeSelections.has(number);
      const disabled =
        !acceptingGuesses ||
        activeTeam === null ||
        (activeAtLimit && !selectedByActive);
      const revealOutcome =
        phase === 'revealed'
          ? this.revealOutcome(ownership, correct.has(number))
          : null;

      return {
        number,
        ownership,
        selected: selectedByActive,
        revealOutcome,
        disabled,
        accessibleLabel: this.cellDescription({
          ownership,
          activeTeam,
          selectedByActive,
          disabled,
          revealOutcome,
          phase,
        }),
      };
    });
  });

  protected toggleGuess(cell: number): void {
    const team = this.game.activeTeam();
    if (team === null) {
      return;
    }

    const wasSelected = this.game.activeSelections().includes(cell);
    const before = this.game.activeSelections().length;
    this.game.toggleGuess(cell as CellNumber);
    const after = this.game.activeSelections().length;
    if (before === after && !wasSelected) {
      this.announcement.set(
        `${this.teamLabel(team)} already has two guesses. Deselect one before choosing another cell.`,
      );
      return;
    }

    if (wasSelected) {
      const remaining = this.game.remainingGuesses();
      this.announcement.set(
        `${this.teamLabel(team)} removed cell ${cell}. ${remaining} ${remaining === 1 ? 'guess remains' : 'guesses remain'}.`,
      );
      return;
    }

    const limitMessage =
      after === MAX_GUESSES
        ? ' Two guesses selected. Other cells are unavailable until one is deselected or the turn is locked.'
        : '';
    this.announcement.set(
      `${this.teamLabel(team)} selected cell ${cell}. ${after} of ${MAX_GUESSES} guesses selected.${limitMessage}`,
    );
  }

  protected lockGuesses(): void {
    const team = this.game.activeTeam();
    if (team === null || !this.game.canLock()) {
      return;
    }

    this.game.lockActiveTeam();
    const nextTeam = this.game.activeTeam();
    if (nextTeam !== null) {
      this.announcement.set(
        `${this.teamLabel(team)} locked two guesses. ${this.teamLabel(nextTeam)} team now chooses.`,
      );
      this.scheduleFocus(() => this.imageGrid()?.focusEntry());
      return;
    }

    this.announcement.set(
      `${this.teamLabel(team)} locked two guesses. Both teams are locked and Reveal is available.`,
    );
    this.scheduleFocus(() => this.revealButton()?.nativeElement.focus());
  }

  protected revealRound(): void {
    if (!this.game.canReveal()) {
      return;
    }

    this.game.reveal();
    const result = this.game.currentCompletedRound();
    if (result === null || this.game.phase() !== 'revealed') {
      return;
    }

    this.announcement.set(
      `Round ${this.roundNumber()} revealed. ${this.teamLabel('red')} scored ${result.red.points}; ${this.teamLabel('blue')} scored ${result.blue.points}.`,
    );
    this.scheduleFocus(() => this.resultHeading()?.nativeElement.focus());
  }

  protected nextRound(): void {
    if (!this.game.canAdvance()) {
      return;
    }

    const previousIndex = this.game.currentImageIndex();
    this.game.advance();
    if (this.game.currentImageIndex() === previousIndex) {
      return;
    }

    const starter = this.game.starter();
    this.announcement.set(
      `Round ${this.roundNumber()} is ready. ${starter === null ? '' : `${this.teamLabel(starter)} starts.`}`.trim(),
    );
    this.scheduleFocus(() => this.roundHeading()?.nativeElement.focus());
  }

  protected viewResults(): void {
    if (!this.game.canFinish()) {
      return;
    }

    this.game.finishGame();
    if (this.game.phase() === 'finished') {
      void this.router.navigate(['/results']);
    }
  }

  protected teamLabel(team: Team): string {
    return this.game.teamName(team);
  }

  protected cellList(cells: readonly number[]): string {
    return cells.length === 0 ? 'None' : cells.join(', ');
  }

  private ownership(
    redSelected: boolean,
    blueSelected: boolean,
  ): ImageGridOwnership {
    if (redSelected && blueSelected) {
      return 'shared';
    }
    if (redSelected) {
      return 'red';
    }
    if (blueSelected) {
      return 'blue';
    }
    return 'none';
  }

  private revealOutcome(
    ownership: ImageGridOwnership,
    correct: boolean,
  ): ImageGridRevealOutcome {
    if (ownership !== 'none') {
      return correct ? 'hit' : 'miss';
    }
    return correct ? 'correct-unselected' : null;
  }

  private cellDescription({
    ownership,
    activeTeam,
    selectedByActive,
    disabled,
    revealOutcome,
    phase,
  }: CellDescriptionContext): string {
    const ownershipLabel = this.ownershipLabel(ownership);
    if (phase === 'revealed') {
      return `${ownershipLabel}. ${
        revealOutcome === null
          ? 'Not guessed and not configured as correct. The whole image is revealed'
          : RESULT_LABELS[revealOutcome]
      }`;
    }

    if (activeTeam === null) {
      return `${ownershipLabel}. Both teams are locked. Selection is unavailable until reveal`;
    }

    const team = this.teamLabel(activeTeam);
    if (selectedByActive) {
      return `${ownershipLabel}. ${team} selected this cell. Available to deselect before locking`;
    }
    if (disabled) {
      return `${ownershipLabel}. ${team} has not selected this cell. Unavailable because ${team} already has two guesses; deselect one to replace it`;
    }
    if (ownership !== 'none') {
      return `${ownershipLabel}. ${team} has not selected this cell. Available to select as a shared guess`;
    }
    return `${ownershipLabel}. ${team} has not selected this cell. Available to select`;
  }

  private ownershipLabel(ownership: ImageGridOwnership): string {
    if (ownership === 'none') {
      return 'No team selected this cell';
    }
    if (ownership === 'red') {
      return `Selected by ${this.teamLabel('red')} (red) only`;
    }
    if (ownership === 'blue') {
      return `Selected by ${this.teamLabel('blue')} (blue) only`;
    }
    return `Selected by both ${this.teamLabel('red')} (red) and ${this.teamLabel('blue')} (blue)`;
  }

  private scheduleFocus(action: () => void): void {
    queueMicrotask(() => {
      if (typeof globalThis.requestAnimationFrame === 'function') {
        globalThis.requestAnimationFrame(() => action());
      } else {
        action();
      }
    });
  }
}
