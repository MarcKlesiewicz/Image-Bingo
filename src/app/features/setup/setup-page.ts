import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { Router } from '@angular/router';

import { GameStateService } from '../../core/game-state.service';
import { CELL_NUMBERS, CellNumber } from '../../models/game.models';
import {
  ImageGrid,
  ImageGridCellView,
} from '../../shared/image-grid/image-grid';

@Component({
  selector: 'app-setup-page',
  imports: [ImageGrid],
  templateUrl: './setup-page.html',
  styleUrl: './setup-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetupPage {
  protected readonly game = inject(GameStateService);
  private readonly router = inject(Router);

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  private readonly configurationHeading =
    viewChild<ElementRef<HTMLHeadingElement>>('configurationHeading');
  private readonly incompleteButtons =
    viewChildren<ElementRef<HTMLButtonElement>>('incompleteButton');
  private readonly setupNotice = signal('');

  protected readonly deckCount = computed(() => this.game.deck().length);
  protected readonly hasDeck = computed(() => this.deckCount() > 0);
  protected readonly activeIndex = computed(() => this.game.configurationIndex());
  protected readonly hasPrevious = computed(() => {
    const index = this.activeIndex();
    return index !== null && index > 0;
  });
  protected readonly hasNext = computed(() => {
    const index = this.activeIndex();
    return index !== null && index < this.deckCount() - 1;
  });
  protected readonly currentPosition = computed(() => {
    const index = this.activeIndex();
    return index === null ? '' : `Image ${index + 1} of ${this.deckCount()}`;
  });
  protected readonly configurationCells = computed<readonly ImageGridCellView[]>(() => {
    const image = this.game.configurationImage();
    const correctCells = new Set(image?.correctCells ?? []);

    return CELL_NUMBERS.map((number) => {
      const selected = correctCells.has(number);
      return {
        number,
        ownership: 'none',
        selected,
        revealOutcome: null,
        disabled: image === null,
        accessibleLabel: selected
          ? 'Selected as a correct cell'
          : 'Not selected as a correct cell',
      };
    });
  });
  protected readonly startGuidance = computed(() => {
    if (this.game.importPending()) {
      return 'Wait while the selected images are checked.';
    }
    if (!this.hasDeck()) {
      return 'Add at least one image to start the game.';
    }
    const incomplete = this.game.incompleteImages().length;
    if (incomplete > 0) {
      return `Choose at least one correct cell for ${incomplete} ${
        incomplete === 1 ? 'image' : 'images'
      }.`;
    }
    return 'The deck is ready. Start game opens round 1.';
  });
  protected readonly importStatus = computed(() => {
    if (this.game.importPending()) {
      return 'Images are being checked. Please wait.';
    }
    if (this.setupNotice()) {
      return this.setupNotice();
    }
    const summary = this.game.importSummary();
    if (summary === null) {
      return 'No image batch has been checked yet.';
    }
    return `${summary.accepted} ${summary.accepted === 1 ? 'image' : 'images'} accepted and ${
      summary.rejected
    } rejected from ${summary.attempted} selected.`;
  });

  protected async importFiles(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    this.setupNotice.set('');

    try {
      await this.game.importFiles(input.files ?? []);
    } finally {
      input.value = '';
    }
  }

  protected selectImage(index: number, focusHeading = false): void {
    this.game.setConfigurationIndex(index);
    if (focusHeading) {
      queueMicrotask(() => this.configurationHeading()?.nativeElement.focus());
    }
  }

  protected moveConfiguration(direction: -1 | 1): void {
    const index = this.activeIndex();
    if (index === null) {
      return;
    }
    this.selectImage(index + direction, true);
  }

  protected toggleCorrectCell(cell: number): void {
    this.game.toggleCurrentCorrectCell(cell as CellNumber);
    this.setupNotice.set('');
  }

  protected removeImage(imageId: string, imageName: string): void {
    if (this.game.importPending()) {
      return;
    }
    this.game.removeImage(imageId);
    this.setupNotice.set(`${imageName} was removed from the deck.`);
    if (!this.hasDeck()) {
      queueMicrotask(() => this.fileInput()?.nativeElement.focus());
    }
  }

  protected clearDeck(): void {
    if (!this.hasDeck() || this.game.importPending()) {
      return;
    }
    const confirmed = globalThis.confirm(
      'Clear the entire deck? This removes all imported images and correct-cell configuration from this browser session.',
    );
    if (!confirmed) {
      return;
    }
    this.game.clearDeck();
    this.setupNotice.set('The image deck and all correct-cell configuration were cleared.');
    queueMicrotask(() => this.fileInput()?.nativeElement.focus());
  }

  protected startGame(): void {
    this.setupNotice.set('');
    if (!this.game.canStart()) {
      this.setupNotice.set(this.startGuidance());
      const firstIncomplete = this.incompleteButtons().at(0)?.nativeElement;
      if (firstIncomplete !== undefined) {
        firstIncomplete.focus();
        firstIncomplete.scrollIntoView({ block: 'center' });
      } else {
        this.fileInput()?.nativeElement.focus();
      }
      return;
    }

    this.game.startGame();
    if (this.game.phase() !== 'setup') {
      void this.router.navigate(['/play']);
    }
  }

  protected correctCellLabel(count: number): string {
    return `${count} correct ${count === 1 ? 'cell' : 'cells'}`;
  }
}
