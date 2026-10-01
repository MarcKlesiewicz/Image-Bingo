import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';

import { Team } from '../../models/game.models';
import {
  faCaretUp,
  faCheck,
  faDiamond,
  faEllipsis,
  faPlay,
  faSquare,
} from '../icons/game-icons';

@Component({
  selector: 'app-scoreboard',
  imports: [FaIconComponent],
  templateUrl: './scoreboard.html',
  styleUrl: './scoreboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Scoreboard {
  protected readonly faCaretUp = faCaretUp;
  protected readonly faCheck = faCheck;
  protected readonly faDiamond = faDiamond;
  protected readonly faEllipsis = faEllipsis;
  protected readonly faPlay = faPlay;
  protected readonly faSquare = faSquare;
  readonly redScore = input.required<number>();
  readonly blueScore = input.required<number>();
  readonly redName = input.required<string>();
  readonly blueName = input.required<string>();
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

  protected teamName(team: Team): string {
    return team === 'red' ? this.redName() : this.blueName();
  }
}
