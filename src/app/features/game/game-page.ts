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
import { CellNumber, Team } from '../../models/game.models';
import {
  ImageGrid,
  ImageGridCellView,
  ImageGridOwnership,
  ImageGridRevealOutcome,
} from '../../shared/image-grid/image-grid';
import { Scoreboard } from '../../shared/scoreboard/scoreboard';

const CELL_NUMBERS = Array.from({ length: 100 }, (_, index) => index + 1);
const MAX_GUESSES = 2;

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
      const count = this.game.activeSelections().length;
      if (count === MAX_GUESSES) {
        return `${this.teamLabel(team)} has two guesses. Deselect a chosen cell to replace it, or lock the turn.`;
      }
      return `Select ${MAX_GUESSES - count} more ${MAX_GUESSES - count === 1 ? 'cell' : 'cells'} for ${this.teamLabel(team)}. Guesses stay editable until Lock guesses.`;
    }
    if (this.game.phase() === 'ready-to-reveal') {
      return 'The board is frozen. Reveal records this round once and shows only the guessed areas.';
    }
    return 'Review both teams’ hits and misses, then continue when the room is ready.';
  });
  protected readonly gridCells = computed<readonly ImageGridCellView[]>(() => {
    const red = new Set(this.game.redSelections());
    const blue = new Set(this.game.blueSelections());
    const activeTeam = this.game.activeTeam();
    const activeSelections = new Set(this.game.activeSelections());
    const activeAtLimit = activeSelections.size >= MAX_GUESSES;
    const phase = this.game.phase();
    const correct = new Set(this.game.currentGameImage()?.correctCells ?? []);

    return CELL_NUMBERS.map((number) => {
      const redSelected = red.has(number);
      const blueSelected = blue.has(number);
      const ownership = this.ownership(redSelected, blueSelected);
      const selectedByActive = activeSelections.has(number);
      const acceptingGuesses =
        phase === 'guessing-first' || phase === 'guessing-second';
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
        accessibleLabel: this.cellDescription(
          ownership,
          activeTeam,
          selectedByActive,
          disabled,
          revealOutcome,
          phase,
        ),
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
      this.announcement.set(
        `${this.teamLabel(team)} removed cell ${cell}. ${MAX_GUESSES - after} ${MAX_GUESSES - after === 1 ? 'guess remains' : 'guesses remain'}.`,
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
      `Round ${this.roundNumber()} revealed. Red scored ${result.red.points}; Blue scored ${result.blue.points}.`,
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
    return team === 'red' ? 'Red' : 'Blue';
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

  private cellDescription(
    ownership: ImageGridOwnership,
    activeTeam: Team | null,
    selectedByActive: boolean,
    disabled: boolean,
    revealOutcome: ImageGridRevealOutcome,
    phase: string,
  ): string {
    const ownershipLabel: Record<ImageGridOwnership, string> = {
      none: 'No team selected this cell',
      red: 'Selected by Red only',
      blue: 'Selected by Blue only',
      shared: 'Selected by both Red and Blue',
    };

    if (phase === 'revealed') {
      const resultLabel: Record<Exclude<ImageGridRevealOutcome, null>, string> = {
        hit: 'Hit. This guessed cell is correct and its image area is revealed',
        miss: 'Miss. This guessed cell is not correct and its image area is revealed',
        'correct-unselected': 'Correct cell, but neither team guessed it. The image remains covered',
      };
      return `${ownershipLabel[ownership]}. ${
        revealOutcome === null
          ? 'Not guessed and not configured as correct. The image remains covered'
          : resultLabel[revealOutcome]
      }`;
    }

    if (activeTeam === null) {
      return `${ownershipLabel[ownership]}. Both teams are locked. Selection is unavailable until reveal`;
    }

    const team = this.teamLabel(activeTeam);
    if (selectedByActive) {
      return `${ownershipLabel[ownership]}. ${team} selected this cell. Available to deselect before locking`;
    }
    if (disabled) {
      return `${ownershipLabel[ownership]}. ${team} has not selected this cell. Unavailable because ${team} already has two guesses; deselect one to replace it`;
    }
    if (ownership !== 'none') {
      return `${ownershipLabel[ownership]}. ${team} has not selected this cell. Available to select as a shared guess`;
    }
    return `${ownershipLabel[ownership]}. ${team} has not selected this cell. Available to select`;
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
