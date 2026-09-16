import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Team } from '../../models/game.models';

@Component({
  selector: 'app-scoreboard',
  templateUrl: './scoreboard.html',
  styleUrl: './scoreboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Scoreboard {
  readonly redScore = input.required<number>();
  readonly blueScore = input.required<number>();
  readonly currentRound = input.required<number>();
  readonly totalRounds = input.required<number>();
  readonly starter = input.required<Team>();
  readonly activeTeam = input<Team | null>(null);
  readonly redLocked = input.required<boolean>();
  readonly blueLocked = input.required<boolean>();

  protected teamState(team: Team, locked: boolean): string {
    if (locked) {
      return 'Locked';
    }
    if (this.activeTeam() === team) {
      return 'Active turn';
    }
    return 'Waiting';
  }
}
