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

export interface DeckImage {
  readonly id: string;
  readonly file: File;
  readonly name: string;
  readonly type: string;
  readonly size: number;
  readonly lastModified: number;
  readonly url: string;
  readonly width: number;
  readonly height: number;
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
  readonly selections: readonly CellNumber[];
  readonly hits: readonly CellNumber[];
  readonly misses: readonly CellNumber[];
  readonly points: number;
}

export interface CompletedRound {
  readonly imageId: string;
  readonly imageName: string;
  readonly imageIndex: number;
  readonly starter: Team;
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

export interface RevealData {
  readonly imageId: string;
  readonly correctCells: readonly CellNumber[];
  readonly correctUnselected: readonly CellNumber[];
  readonly redHits: readonly CellNumber[];
  readonly redMisses: readonly CellNumber[];
  readonly blueHits: readonly CellNumber[];
  readonly blueMisses: readonly CellNumber[];
}
