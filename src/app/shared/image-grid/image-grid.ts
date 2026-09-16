import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import { Grid, GridCell, GridRow } from '@angular/aria/grid';

import { CELL_COUNT, GRID_SIZE } from '../../models/game.models';

export type ImageGridMode = 'configure' | 'covered' | 'revealed';
export type ImageGridOwnership = 'none' | 'red' | 'blue' | 'shared';
export type ImageGridRevealOutcome =
  | 'hit'
  | 'miss'
  | 'correct-unselected'
  | null;

export interface ImageGridCellView {
  readonly number: number;
  readonly ownership: ImageGridOwnership;
  readonly selected: boolean;
  readonly revealOutcome: ImageGridRevealOutcome;
  readonly disabled: boolean;
  readonly accessibleLabel: string;
}

const MINIMUM_CELL_SIZE = 40;

@Component({
  selector: 'app-image-grid',
  imports: [Grid, GridRow, GridCell],
  templateUrl: './image-grid.html',
  styleUrl: './image-grid.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageGrid {
  readonly url = input.required<string>();
  readonly alt = input.required<string>();
  readonly intrinsicWidth = input.required<number>();
  readonly intrinsicHeight = input.required<number>();
  readonly mode = input.required<ImageGridMode>();
  readonly cells = input.required<readonly ImageGridCellView[]>();

  readonly cellActivated = output<number>();

  private readonly gridElement = viewChild<ElementRef<HTMLElement>>('grid');

  protected readonly hasValidCells = computed(() => {
    const cells = this.cells();

    return (
      cells.length === CELL_COUNT &&
      cells.every((cell, index) => cell.number === index + 1)
    );
  });

  protected readonly rows = computed<readonly (readonly ImageGridCellView[])[]>(() => {
    const cells = this.hasValidCells()
      ? this.cells()
      : Array.from({ length: CELL_COUNT }, (_, index) =>
          this.unavailableCell(index + 1),
        );

    return Array.from({ length: GRID_SIZE }, (_, rowIndex) =>
      cells.slice(rowIndex * GRID_SIZE, (rowIndex + 1) * GRID_SIZE),
    );
  });

  protected readonly safeWidth = computed(() => this.safeDimension(this.intrinsicWidth()));
  protected readonly safeHeight = computed(() => this.safeDimension(this.intrinsicHeight()));
  protected readonly aspectRatio = computed(
    () => `${this.safeWidth()} / ${this.safeHeight()}`,
  );
  protected readonly minimumBoardWidth = computed(() => {
    const ratio = this.safeWidth() / this.safeHeight();
    return Math.ceil(
      GRID_SIZE * MINIMUM_CELL_SIZE * Math.max(1, ratio),
    );
  });

  /** Moves focus to the grid's current roving entry cell. */
  focusEntry(): void {
    const grid = this.gridElement()?.nativeElement;
    const target =
      grid?.querySelector<HTMLElement>('[ngGridCell][tabindex="0"]') ??
      grid?.querySelector<HTMLElement>('[ngGridCell]');

    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  protected activate(cell: ImageGridCellView): void {
    if (!this.hasValidCells() || cell.disabled) {
      return;
    }

    this.cellActivated.emit(cell.number);
  }

  protected isSelected(cell: ImageGridCellView): boolean {
    return cell.selected || cell.ownership !== 'none';
  }

  protected cellLabel(cell: ImageGridCellView): string {
    const detail = cell.accessibleLabel.trim() || 'No state details';
    const availability = cell.disabled ? ' Disabled.' : '';
    return `Cell ${cell.number}. ${detail}.${availability}`;
  }

  private safeDimension(value: number): number {
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  private unavailableCell(number: number): ImageGridCellView {
    return {
      number,
      ownership: 'none',
      selected: false,
      revealOutcome: null,
      disabled: true,
      accessibleLabel: 'Grid data unavailable',
    };
  }
}
