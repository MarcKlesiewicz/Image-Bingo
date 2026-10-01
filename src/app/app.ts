import { Component, HostListener, computed, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';

import { GameStateService } from './core/game-state.service';
import { GameRoute } from './models/game.models';
import { faCheck, faTableCellsLarge } from './shared/icons/game-icons';

interface NavigationItem {
  readonly label: string;
  readonly route: GameRoute;
}

@Component({
  selector: 'app-root',
  imports: [FaIconComponent, RouterLink, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly faCheck = faCheck;
  protected readonly faTableCellsLarge = faTableCellsLarge;
  protected readonly game = inject(GameStateService);
  protected readonly navigation: readonly NavigationItem[] = [
    { label: 'Setup', route: 'setup' },
    { label: 'Play', route: 'play' },
    { label: 'Results', route: 'results' },
  ];
  protected readonly currentStageIndex = computed(() =>
    this.navigation.findIndex((item) => item.route === this.game.routePhase()),
  );
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

  protected isCurrent(item: NavigationItem): boolean {
    return item.route === this.game.routePhase();
  }

  protected isComplete(index: number): boolean {
    return index < this.currentStageIndex();
  }

  private stageLabel(route: GameRoute): string {
    return this.navigation.find((item) => item.route === route)?.label ?? 'Game';
  }
}
