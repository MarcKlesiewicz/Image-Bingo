import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Grid, GridCell, GridRow } from '@angular/aria/grid';

import {
  CELL_COUNT,
  GRID_SIZE,
  GridPlacement,
  gridPlacementsEqual,
  MAX_GRID_PLACEMENT_SIZE,
  MIN_GRID_PLACEMENT_SIZE,
  normalizeGridPlacement,
  safeImageDimension,
} from '../../models/game.models';

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
const KEYBOARD_STEP = 0.01;
const LARGE_KEYBOARD_STEP = 0.05;

const RESIZE_DIRECTIONS = {
  'north-west': { horizontal: -1, vertical: -1 },
  'north-east': { horizontal: 1, vertical: -1 },
  'south-west': { horizontal: -1, vertical: 1 },
  'south-east': { horizontal: 1, vertical: 1 },
} as const;

type ResizeCorner = keyof typeof RESIZE_DIRECTIONS;

interface PointerInteraction {
  readonly pointerId: number;
  readonly kind: 'move' | ResizeCorner;
  readonly startClientX: number;
  readonly startClientY: number;
  readonly placement: GridPlacement;
  readonly boardWidth: number;
  readonly boardHeight: number;
  readonly imageId: string;
  readonly target: HTMLElement;
}

@Component({
  selector: 'app-image-grid',
  imports: [Grid, GridRow, GridCell],
  templateUrl: './image-grid.html',
  styleUrl: './image-grid.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageGrid {
  protected readonly resizeCorners = Object.keys(
    RESIZE_DIRECTIONS,
  ) as ResizeCorner[];
  readonly url = input.required<string>();
  readonly imageId = input.required<string>();
  readonly alt = input.required<string>();
  readonly intrinsicWidth = input.required<number>();
  readonly intrinsicHeight = input.required<number>();
  readonly placement = input.required<GridPlacement>();
  readonly mode = input.required<ImageGridMode>();
  readonly cells = input.required<readonly ImageGridCellView[]>();

  readonly cellActivated = output<number>();
  readonly placementChanged = output<GridPlacement>();

  private readonly gridElement = viewChild<ElementRef<HTMLElement>>('grid');
  private readonly boardElement = viewChild<ElementRef<HTMLElement>>('board');
  private readonly draftPlacement = signal<GridPlacement | null>(null);
  private pointerInteraction: PointerInteraction | null = null;
  private readonly cancelInteractionOnContextChange = effect(() => {
    const imageId = this.imageId();
    const mode = this.mode();
    const interaction = this.pointerInteraction;

    if (
      interaction !== null &&
      (interaction.imageId !== imageId || mode !== 'configure')
    ) {
      this.cancelActiveInteraction(interaction);
    }
  });

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
  protected readonly numericAspectRatio = computed(
    () => this.safeWidth() / this.safeHeight(),
  );
  private readonly committedPlacement = computed(() =>
    normalizeGridPlacement(
      this.placement(),
      this.safeWidth(),
      this.safeHeight(),
      MIN_GRID_PLACEMENT_SIZE,
    ),
  );
  protected readonly activePlacement = computed(() =>
    normalizeGridPlacement(
      this.draftPlacement() ?? this.committedPlacement(),
      this.safeWidth(),
      this.safeHeight(),
      MIN_GRID_PLACEMENT_SIZE,
    ),
  );
  protected readonly placementLeft = computed(() => this.activePlacement().x * 100);
  protected readonly placementTop = computed(() => this.activePlacement().y * 100);
  protected readonly placementWidth = computed(
    () =>
      (this.activePlacement().size * Math.min(this.safeWidth(), this.safeHeight()) * 100) /
      this.safeWidth(),
  );
  protected readonly placementHeight = computed(
    () =>
      (this.activePlacement().size * Math.min(this.safeWidth(), this.safeHeight()) * 100) /
      this.safeHeight(),
  );
  protected readonly minimumBoardWidth = computed(() => {
    const ratio = this.numericAspectRatio();
    return Math.ceil(
      (GRID_SIZE * MINIMUM_CELL_SIZE * Math.max(1, ratio)) /
        this.committedPlacement().size,
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

  protected beginMove(event: PointerEvent): void {
    this.beginPointerInteraction(event, 'move');
  }

  protected beginResize(event: PointerEvent, corner: ResizeCorner): void {
    this.beginPointerInteraction(event, corner);
  }

  protected updatePointerInteraction(event: PointerEvent): void {
    const interaction = this.pointerInteraction;
    if (interaction === null || event.pointerId !== interaction.pointerId) {
      return;
    }

    event.preventDefault();
    const deltaX = event.clientX - interaction.startClientX;
    const deltaY = event.clientY - interaction.startClientY;
    const next =
      interaction.kind === 'move'
        ? this.movePlacement(interaction, deltaX, deltaY)
        : this.resizePlacement(
            interaction,
            interaction.kind,
            deltaX,
            deltaY,
          );
    if (!gridPlacementsEqual(next, this.draftPlacement() ?? interaction.placement)) {
      this.draftPlacement.set(next);
    }
  }

  protected finishPointerInteraction(event: PointerEvent): void {
    const interaction = this.pointerInteraction;
    if (interaction === null || event.pointerId !== interaction.pointerId) {
      return;
    }

    if (interaction.imageId !== this.imageId() || this.mode() !== 'configure') {
      this.cancelActiveInteraction(interaction);
      return;
    }

    const target = interaction.target;
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
    this.pointerInteraction = null;
    this.commitPlacement(this.draftPlacement() ?? interaction.placement);
  }

  protected cancelPointerInteraction(event: PointerEvent): void {
    if (event.pointerId !== this.pointerInteraction?.pointerId) {
      return;
    }
    this.cancelActiveInteraction(this.pointerInteraction);
  }

  protected moveWithKeyboard(event: KeyboardEvent): void {
    const step = event.shiftKey ? LARGE_KEYBOARD_STEP : KEYBOARD_STEP;
    const placement = this.activePlacement();
    let x = placement.x;
    let y = placement.y;

    switch (event.key) {
      case 'ArrowLeft':
        x -= step;
        break;
      case 'ArrowRight':
        x += step;
        break;
      case 'ArrowUp':
        y -= step;
        break;
      case 'ArrowDown':
        y += step;
        break;
      default:
        return;
    }

    event.preventDefault();
    this.commitPlacement({ ...placement, x, y });
  }

  protected resizeWithKeyboard(
    event: KeyboardEvent,
    corner: ResizeCorner,
  ): void {
    const direction =
      event.key === 'ArrowUp' || event.key === 'ArrowRight'
        ? 1
        : event.key === 'ArrowDown' || event.key === 'ArrowLeft'
          ? -1
          : 0;
    if (direction === 0) {
      return;
    }

    event.preventDefault();
    const step = event.shiftKey ? LARGE_KEYBOARD_STEP : KEYBOARD_STEP;
    this.commitPlacement(
      this.resizeFromCorner(this.activePlacement(), corner, direction * step),
    );
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
    return safeImageDimension(value);
  }

  private beginPointerInteraction(
    event: PointerEvent,
    kind: PointerInteraction['kind'],
  ): void {
    if (event.button !== 0 || this.mode() !== 'configure') {
      return;
    }
    const board = this.boardElement()?.nativeElement.getBoundingClientRect();
    if (board === undefined || board.width <= 0 || board.height <= 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    const placement = this.activePlacement();
    this.pointerInteraction = {
      pointerId: event.pointerId,
      kind,
      startClientX: event.clientX,
      startClientY: event.clientY,
      placement,
      boardWidth: board.width,
      boardHeight: board.height,
      imageId: this.imageId(),
      target,
    };
    this.draftPlacement.set(placement);
  }

  private movePlacement(
    interaction: PointerInteraction,
    deltaX: number,
    deltaY: number,
  ): GridPlacement {
    return normalizeGridPlacement({
      ...interaction.placement,
      x: interaction.placement.x + deltaX / interaction.boardWidth,
      y: interaction.placement.y + deltaY / interaction.boardHeight,
    }, this.safeWidth(), this.safeHeight(), MIN_GRID_PLACEMENT_SIZE);
  }

  private resizePlacement(
    interaction: PointerInteraction,
    corner: ResizeCorner,
    deltaX: number,
    deltaY: number,
  ): GridPlacement {
    const { horizontal, vertical } = RESIZE_DIRECTIONS[corner];
    const pixelDelta =
      (horizontal * deltaX + vertical * deltaY) / 2;
    const sizeDelta =
      pixelDelta / Math.min(interaction.boardWidth, interaction.boardHeight);
    return this.resizeFromCorner(
      interaction.placement,
      corner,
      sizeDelta,
    );
  }

  private resizeFromCorner(
    placement: GridPlacement,
    corner: ResizeCorner,
    sizeDelta: number,
  ): GridPlacement {
    const width = this.safeWidth();
    const height = this.safeHeight();
    const shorterSide = Math.min(width, height);
    const { horizontal, vertical } = RESIZE_DIRECTIONS[corner];
    const currentSide = placement.size * shorterSide;
    const left = placement.x * width;
    const top = placement.y * height;
    const anchorX = horizontal === 1 ? left : left + currentSide;
    const anchorY = vertical === 1 ? top : top + currentSide;
    const maximumSide = Math.min(
      horizontal === 1 ? width - anchorX : anchorX,
      vertical === 1 ? height - anchorY : anchorY,
      MAX_GRID_PLACEMENT_SIZE * shorterSide,
    );
    const side = this.clamp(
      currentSide + sizeDelta * shorterSide,
      MIN_GRID_PLACEMENT_SIZE * shorterSide,
      maximumSide,
    );
    const nextLeft = horizontal === 1 ? anchorX : anchorX - side;
    const nextTop = vertical === 1 ? anchorY : anchorY - side;
    return normalizeGridPlacement({
      x: nextLeft / width,
      y: nextTop / height,
      size: side / shorterSide,
    }, width, height, MIN_GRID_PLACEMENT_SIZE);
  }

  private commitPlacement(placement: GridPlacement): void {
    const next = normalizeGridPlacement(
      placement,
      this.safeWidth(),
      this.safeHeight(),
      MIN_GRID_PLACEMENT_SIZE,
    );
    if (!gridPlacementsEqual(next, this.placement())) {
      this.placementChanged.emit(next);
    }
    this.draftPlacement.set(null);
  }

  private cancelActiveInteraction(
    interaction: PointerInteraction | null,
  ): void {
    if (interaction === null) {
      return;
    }
    if (interaction.target.hasPointerCapture(interaction.pointerId)) {
      interaction.target.releasePointerCapture(interaction.pointerId);
    }
    this.pointerInteraction = null;
    this.draftPlacement.set(null);
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
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
