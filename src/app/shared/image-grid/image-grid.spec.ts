import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { createCenteredGridPlacement, GridPlacement } from '../../models/game.models';
import { ImageGrid, ImageGridCellView, ImageGridMode } from './image-grid';

function createCells(
  overrides: Readonly<Record<number, Partial<ImageGridCellView>>> = {},
): readonly ImageGridCellView[] {
  return Array.from({ length: 100 }, (_, index) => {
    const number = index + 1;
    return {
      number,
      ownership: 'none',
      selected: false,
      revealOutcome: null,
      disabled: false,
      accessibleLabel: 'Available',
      ...overrides[number],
    } as ImageGridCellView;
  });
}

describe('ImageGrid', () => {
  let fixture: ComponentFixture<ImageGrid>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ImageGrid] }).compileComponents();
    fixture = TestBed.createComponent(ImageGrid);
  });

  function render(options: {
    width?: number;
    height?: number;
    mode?: ImageGridMode;
    placement?: GridPlacement;
    cells?: readonly ImageGridCellView[];
  } = {}): HTMLElement {
    const width = options.width ?? 12_000;
    const height = options.height ?? 800;
    fixture.componentRef.setInput('url', 'blob:test-image');
    fixture.componentRef.setInput('imageId', 'image-1');
    fixture.componentRef.setInput('alt', 'Test image');
    fixture.componentRef.setInput('intrinsicWidth', width);
    fixture.componentRef.setInput('intrinsicHeight', height);
    fixture.componentRef.setInput(
      'placement',
      options.placement ?? createCenteredGridPlacement(width, height),
    );
    fixture.componentRef.setInput('mode', options.mode ?? 'configure');
    fixture.componentRef.setInput('cells', options.cells ?? createCells());
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it.each([
    [12_000, 800, '12000 / 800'],
    [800, 12_000, '800 / 12000'],
    [160, 90, '160 / 90'],
  ])(
    'fits a %s by %s configure image without an intrinsic minimum width',
    (width, height, aspectRatio) => {
      const element = render({ width, height });
      const board = element.querySelector<HTMLElement>('.image-board');

      expect(board?.style.minWidth).toBe('');
      expect(board?.style.aspectRatio).toBe(aspectRatio);
      expect(element.querySelector('.board-scroll')?.classList).toContain(
        'is-configuring',
      );
    },
  );

  it('keeps the Move Grid control attached above the placement overlay', () => {
    const element = render({
      placement: { x: 0, y: 0, size: 0.3 },
    });
    const placement = element.querySelector('.grid-placement');
    const moveHandle = placement?.querySelector<HTMLButtonElement>(
      ':scope > .move-handle',
    );

    expect(moveHandle).not.toBeNull();
    expect(element.querySelector('.placement-toolbar')).toBeNull();
    expect(moveHandle?.getAttribute('aria-label')).toContain('Use arrow keys');
    expect(moveHandle?.querySelector('fa-icon')).not.toBeNull();
  });

  it('preserves fractional keyboard movement after fitting the image', () => {
    const placement: GridPlacement = { x: 0.2, y: 0.2, size: 0.3 };
    const element = render({ width: 12_000, height: 800, placement });
    const emitted: GridPlacement[] = [];
    fixture.componentInstance.placementChanged.subscribe((value) => emitted.push(value));
    const moveHandle = element.querySelector<HTMLButtonElement>('.move-handle');

    moveHandle?.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.x).toBeCloseTo(0.21);
    expect(emitted[0]?.y).toBe(placement.y);
    expect(emitted[0]?.size).toBe(placement.size);
  });

  it('uses distinct border states for revealed outcomes without outcome markers', () => {
    const element = render({
      mode: 'revealed',
      cells: createCells({
        1: { ownership: 'shared', revealOutcome: 'miss' },
        2: { ownership: 'red', revealOutcome: 'hit' },
        3: { revealOutcome: 'correct-unselected' },
      }),
    });
    const sharedOwnership = element.querySelector('.cell.is-shared .ownership-marker');
    expect(sharedOwnership?.querySelectorAll('.ownership-dot')).toHaveLength(2);
    expect(element.querySelectorAll('.cell.is-correct')).toHaveLength(1);
    expect(element.querySelectorAll('.cell.is-hit')).toHaveLength(1);
    expect(element.querySelectorAll('.cell.is-miss')).toHaveLength(1);
    expect(element.querySelector('.outcome-marker')).toBeNull();
  });

  it('uses a Font Awesome plus inside every accessible resize handle without a configured marker', () => {
    const element = render({
      cells: createCells({ 1: { selected: true } }),
    });
    const handles = Array.from(
      element.querySelectorAll<HTMLButtonElement>('.resize-handle'),
    );

    expect(handles).toHaveLength(4);
    expect(handles.every((handle) => handle.querySelector('fa-icon'))).toBe(true);
    expect(handles.every((handle) => handle.getAttribute('aria-label')?.includes('Resize')))
      .toBe(true);
    expect(element.querySelector('.configured-marker')).toBeNull();
  });
});
