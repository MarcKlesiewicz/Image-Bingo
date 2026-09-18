import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';

import { GameStateService } from '../../core/game-state.service';
import { Winner } from '../../models/game.models';

@Component({
  selector: 'app-results-page',
  templateUrl: './results-page.html',
  styleUrl: './results-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultsPage {
  protected readonly game = inject(GameStateService);
  private readonly router = inject(Router);
  private readonly resultsHeading =
    viewChild<ElementRef<HTMLHeadingElement>>('resultsHeading');
  private readonly announcement = signal('');

  protected readonly liveAnnouncement = this.announcement.asReadonly();
  protected readonly outcomeTitle = computed(() => {
    const labels: Record<Winner, string> = {
      red: `${this.game.redTeamName()} wins!`,
      blue: `${this.game.blueTeamName()} wins!`,
      draw: 'It’s a draw!',
    };
    return labels[this.game.winner() ?? 'draw'];
  });
  protected readonly outcomeIcon = computed(() => {
    const icons: Record<Winner, string> = {
      red: '▲',
      blue: '■',
      draw: '=',
    };
    return icons[this.game.winner() ?? 'draw'];
  });
  protected readonly outcomeSummary = computed(() => {
    const winner = this.game.winner();
    const scores = this.game.scores();
    if (winner === 'red') {
      return `${this.game.redTeamName()} takes the game by ${scores.red - scores.blue} ${scores.red - scores.blue === 1 ? 'point' : 'points'}.`;
    }
    if (winner === 'blue') {
      return `${this.game.blueTeamName()} takes the game by ${scores.blue - scores.red} ${scores.blue - scores.red === 1 ? 'point' : 'points'}.`;
    }
    return `${this.game.redTeamName()} and ${this.game.blueTeamName()} finish level. Share the glory.`;
  });
  protected readonly resultAnnouncement = computed(() => {
    const scores = this.game.scores();
    return `Final score: ${this.game.redTeamName()} ${scores.red}, ${this.game.blueTeamName()} ${scores.blue}. ${this.outcomeTitle()}`;
  });

  constructor() {
    afterNextRender(() => this.resultsHeading()?.nativeElement.focus());
  }

  protected returnToSetup(): void {
    this.game.returnToSetup();
    if (this.game.phase() !== 'setup') {
      this.announcement.set('The game could not return to setup.');
      return;
    }

    this.announcement.set(
      'Run cleared. Images and winning cells are preserved. Returning to setup.',
    );
    void this.router.navigate(['/setup']);
  }
}
