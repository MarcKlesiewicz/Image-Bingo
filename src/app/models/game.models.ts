export type Team = 'red' | 'blue';

export type GamePhase =
  | 'setup'
  | 'guessing-first'
  | 'guessing-second'
  | 'ready-to-reveal'
  | 'revealed'
  | 'finished';

export type PlayPhase = Exclude<GamePhase, 'setup' | 'finished'>;
export type GameRoute = 'setup' | 'play' | 'results';
export type CellNumber = number;

export const GRID_SIZE = 10;
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;
export const CELL_NUMBERS = Array.from(
  { length: CELL_COUNT },
  (_, index) => index + 1,
) as readonly CellNumber[];
export const MAX_GUESSES = 2;
export const DEFAULT_GRID_PLACEMENT_SIZE = 0.46;
export const MIN_GRID_PLACEMENT_SIZE = 0.3;
export const MAX_GRID_PLACEMENT_SIZE = 0.9;

export interface GridPlacement {
  /** Horizontal position as a fraction of the image width. */
  readonly x: number;
  /** Vertical position as a fraction of the image height. */
  readonly y: number;
  /** Square side length as a fraction of the image's shorter side. */
  readonly size: number;
}

export function createCenteredGridPlacement(
  width: number,
  height: number,
): GridPlacement {
  const safeWidth = safeImageDimension(width);
  const safeHeight = safeImageDimension(height);
  const shorterSide = Math.min(safeWidth, safeHeight);
  const widthFraction =
    (DEFAULT_GRID_PLACEMENT_SIZE * shorterSide) / safeWidth;
  const heightFraction =
    (DEFAULT_GRID_PLACEMENT_SIZE * shorterSide) / safeHeight;
  return {
    x: (1 - widthFraction) / 2,
    y: (1 - heightFraction) / 2,
    size: DEFAULT_GRID_PLACEMENT_SIZE,
  };
}

export function normalizeGridPlacement(
  placement: GridPlacement,
  width: number,
  height: number,
  invalidSizeFallback = DEFAULT_GRID_PLACEMENT_SIZE,
): GridPlacement {
  const safeWidth = safeImageDimension(width);
  const safeHeight = safeImageDimension(height);
  const shorterSide = Math.min(safeWidth, safeHeight);
  const size = clamp(
    Number.isFinite(placement.size) ? placement.size : invalidSizeFallback,
    MIN_GRID_PLACEMENT_SIZE,
    MAX_GRID_PLACEMENT_SIZE,
  );
  const widthFraction = (size * shorterSide) / safeWidth;
  const heightFraction = (size * shorterSide) / safeHeight;
  return {
    x: clamp(Number.isFinite(placement.x) ? placement.x : 0, 0, 1 - widthFraction),
    y: clamp(Number.isFinite(placement.y) ? placement.y : 0, 0, 1 - heightFraction),
    size,
  };
}

export function safeImageDimension(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function gridPlacementsEqual(
  left: GridPlacement,
  right: GridPlacement,
): boolean {
  return left.x === right.x && left.y === right.y && left.size === right.size;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export interface DeckImage {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly size: number;
  readonly lastModified: number;
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly gridPlacement: GridPlacement;
  readonly correctCells: readonly CellNumber[];
}

export interface TeamSelections {
  readonly red: readonly CellNumber[];
  readonly blue: readonly CellNumber[];
}

export interface TeamLocks {
  readonly red: boolean;
  readonly blue: boolean;
}

export interface RoundSelection {
  readonly imageId: string;
  readonly starter: Team;
  readonly selections: TeamSelections;
  readonly locks: TeamLocks;
}

export interface CompletedTeamRound {
  readonly hits: readonly CellNumber[];
  readonly misses: readonly CellNumber[];
  readonly points: number;
}

export interface CompletedRound {
  readonly imageId: string;
  readonly imageName: string;
  readonly correctCells: readonly CellNumber[];
  readonly correctUnselected: readonly CellNumber[];
  readonly red: CompletedTeamRound;
  readonly blue: CompletedTeamRound;
}

export interface Score {
  readonly red: number;
  readonly blue: number;
}

export type Winner = Team | 'draw';

export type ImportErrorReason =
  | 'not-an-image'
  | 'likely-duplicate'
  | 'decode-failed';

export interface ImageImportError {
  readonly fileName: string;
  readonly reason: ImportErrorReason;
  readonly message: string;
}

export interface ImageImportSummary {
  readonly attempted: number;
  readonly accepted: number;
  readonly rejected: number;
}

interface SharedGameState {
  readonly deck: readonly DeckImage[];
  readonly configurationIndex: number | null;
  readonly importPending: boolean;
  readonly importErrors: readonly ImageImportError[];
  readonly importSummary: ImageImportSummary | null;
  readonly completedRounds: readonly CompletedRound[];
}

export interface SetupGameState extends SharedGameState {
  readonly phase: 'setup';
  readonly currentImageIndex: null;
  readonly round: null;
}

export interface ActiveGameState extends SharedGameState {
  readonly phase: PlayPhase;
  readonly currentImageIndex: number;
  readonly round: RoundSelection;
}

export interface FinishedGameState extends SharedGameState {
  readonly phase: 'finished';
  readonly currentImageIndex: number;
  readonly round: null;
}

export type GameState = SetupGameState | ActiveGameState | FinishedGameState;
