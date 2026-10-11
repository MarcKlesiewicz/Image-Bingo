import { Component, HostListener, computed, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';

import { GameStateService } from './core/game-state.service';
import { GameRoute } from './models/game.models';
import { faTableCellsLarge } from './shared/icons/game-icons';

@Component({
  selector: 'app-root',
  imports: [FaIconComponent, RouterLink, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly faTableCellsLarge = faTableCellsLarge;
  protected readonly game = inject(GameStateService);
  protected readonly shellAnnouncement = computed(
    () => `${this.stageLabel(this.game.routePhase())} stage.`,
  );
  protected readonly headerTitle = computed(() =>
    this.game.routePhase() === 'setup' ? 'Image Bingo' : this.game.gameName(),
  );

  @HostListener('window:beforeunload', ['$event'])
  protected warnBeforeLeaving(event: BeforeUnloadEvent): void {
    if (!this.game.isInProgress()) {
      return;
    }
    event.preventDefault();
    event.returnValue = '';
  }

  private stageLabel(route: GameRoute): string {
    return { setup: 'Setup', play: 'Play', results: 'Results' }[route];
  }
}
