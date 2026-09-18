import { Injectable, OnDestroy, computed, signal } from '@angular/core';

import {
  CellNumber,
  CompletedRound,
  CompletedTeamRound,
  createCenteredGridPlacement,
  DeckImage,
  GamePhase,
  GameRoute,
  GameState,
  GridPlacement,
  gridPlacementsEqual,
  ImageImportError,
  ImageImportSummary,
  MAX_GAME_NAME_LENGTH,
  MAX_GUESSES,
  MAX_TEAM_NAME_LENGTH,
  normalizeGridPlacement,
  RoundSelection,
  Score,
  Team,
  TeamNames,
  Winner,
} from '../models/game.models';

const FIRST_CELL = 1;
const LAST_CELL = 100;
const DEFAULT_GAME_NAME = 'Image Bingo';
const DEFAULT_TEAM_NAMES: TeamNames = {
  red: 'Red',
  blue: 'Blue',
};

const INITIAL_STATE: GameState = {
  phase: 'setup',
  gameName: DEFAULT_GAME_NAME,
  teamNames: DEFAULT_TEAM_NAMES,
  deck: [],
  configurationIndex: null,
  importPending: false,
  importErrors: [],
  importSummary: null,
  completedRounds: [],
  currentImageIndex: null,
  round: null,
};

@Injectable({ providedIn: 'root' })
export class GameStateService implements OnDestroy {
  private readonly writableState = signal<GameState>(INITIAL_STATE);
  private readonly ownedObjectUrls = new Set<string>();
  private importGeneration = 0;
  private imageSequence = 0;
  private destroyed = false;

  private readonly state = this.writableState.asReadonly();
  readonly phase = computed(() => this.state().phase);
  readonly configuredGameName = computed(() => this.state().gameName);
  readonly configuredTeamNames = computed(() => this.state().teamNames);
  readonly gameName = computed(() =>
    displayName(this.state().gameName, DEFAULT_GAME_NAME),
  );
  readonly redTeamName = computed(() =>
    displayName(this.state().teamNames.red, DEFAULT_TEAM_NAMES.red),
  );
  readonly blueTeamName = computed(() =>
    displayName(this.state().teamNames.blue, DEFAULT_TEAM_NAMES.blue),
  );
  readonly isInProgress = computed(() => {
    const phase = this.state().phase;
    return phase !== 'setup' && phase !== 'finished';
  });
  readonly deck = computed(() => this.state().deck);
  readonly importPending = computed(() => this.state().importPending);
  readonly importErrors = computed(() => this.state().importErrors);
  readonly importSummary = computed(() => this.state().importSummary);
  readonly configurationIndex = computed(() => this.state().configurationIndex);
  readonly configurationImage = computed(() => {
    const state = this.state();
    return state.configurationIndex === null
      ? null
      : (state.deck[state.configurationIndex] ?? null);
  });
  readonly incompleteImages = computed(() =>
    this.deck().filter((image) => image.correctCells.length === 0),
  );
  readonly canStart = computed(() => {
    const state = this.state();
    return (
      state.phase === 'setup' &&
      !state.importPending &&
      state.deck.length > 0 &&
      this.incompleteImages().length === 0
    );
  });

  readonly currentImageIndex = computed(() => this.state().currentImageIndex);
  readonly currentGameImage = computed(() => {
    const state = this.state();
    return state.currentImageIndex === null
      ? null
      : (state.deck[state.currentImageIndex] ?? null);
  });
  readonly starter = computed<Team | null>(() => {
    const state = this.state();
    return state.round?.starter ?? null;
  });
  readonly activeTeam = computed<Team | null>(() => {
    const state = this.state();
    if (state.phase === 'guessing-first') {
      return state.round.starter;
    }
    if (state.phase === 'guessing-second') {
      return otherTeam(state.round.starter);
    }
    return null;
  });
  readonly redSelections = computed(() => this.state().round?.selections.red ?? []);
  readonly blueSelections = computed(() => this.state().round?.selections.blue ?? []);
  readonly redLocked = computed(() => this.state().round?.locks.red ?? false);
  readonly blueLocked = computed(() => this.state().round?.locks.blue ?? false);
  readonly activeSelections = computed(() => {
    const team = this.activeTeam();
    if (team === null) {
      return [];
    }
    return team === 'red' ? this.redSelections() : this.blueSelections();
  });
  readonly remainingGuesses = computed(() => MAX_GUESSES - this.activeSelections().length);
  readonly canLock = computed(() => {
    const state = this.state();
    const team = this.activeTeam();
    return (
      team !== null &&
      state.round !== null &&
      !state.round.locks[team] &&
      state.round.selections[team].length === MAX_GUESSES
    );
  });
  readonly canReveal = computed(() => {
    const state = this.state();
    return (
      state.phase === 'ready-to-reveal' &&
      bothTeamsAreComplete(state.round) &&
      !state.completedRounds.some((round) => round.imageId === state.round.imageId)
    );
  });
  readonly completedRounds = computed(() => this.state().completedRounds);
  readonly currentCompletedRound = computed(() => {
    const image = this.currentGameImage();
    return image === null
      ? null
        : (this.completedRounds().find((round) => round.imageId === image.id) ?? null);
  });
  readonly isLastRound = computed(() => {
    const state = this.state();
    return (
      state.currentImageIndex !== null &&
      state.deck.length > 0 &&
      state.currentImageIndex === state.deck.length - 1
    );
  });
  readonly canAdvance = computed(() => {
    const state = this.state();
    return (
      state.phase === 'revealed' &&
      state.currentImageIndex < state.deck.length - 1 &&
      this.currentCompletedRound() !== null
    );
  });
  readonly canFinish = computed(() => {
    const state = this.state();
    return state.phase === 'revealed' && this.isLastRound() && this.currentCompletedRound() !== null;
  });
  readonly scores = computed<Score>(() =>
    this.completedRounds().reduce(
      (score, round) => ({
        red: score.red + round.red.points,
        blue: score.blue + round.blue.points,
      }),
      { red: 0, blue: 0 },
    ),
  );
  readonly winner = computed<Winner | null>(() => {
    if (this.state().phase !== 'finished') {
      return null;
    }
    const score = this.scores();
    if (score.red === score.blue) {
      return 'draw';
    }
    return score.red > score.blue ? 'red' : 'blue';
  });
  readonly routePhase = computed<GameRoute>(() => routeForPhase(this.state().phase));
  readonly authoritativeRoute = computed(() => `/${this.routePhase()}`);

  setGameName(name: string): void {
    const state = this.state();
    if (state.phase !== 'setup') {
      return;
    }
    const gameName = name.slice(0, MAX_GAME_NAME_LENGTH);
    if (gameName === state.gameName) {
      return;
    }
    this.writableState.set({
      ...state,
      gameName,
    });
  }

  setTeamName(team: Team, name: string): void {
    const state = this.state();
    if (state.phase !== 'setup') {
      return;
    }
    const teamName = name.slice(0, MAX_TEAM_NAME_LENGTH);
    if (teamName === state.teamNames[team]) {
      return;
    }
    this.writableState.set({
      ...state,
      teamNames: {
        ...state.teamNames,
        [team]: teamName,
      },
    });
  }

  teamName(team: Team): string {
    return team === 'red' ? this.redTeamName() : this.blueTeamName();
  }

  async importFiles(input: FileList | readonly File[]): Promise<void> {
    const files = Array.from(input);
    const initial = this.state();
    if (
      this.destroyed ||
      initial.phase !== 'setup' ||
      files.length === 0
    ) {
      return;
    }

    const generation = ++this.importGeneration;
    const errors: ImageImportError[] = [];
    let accepted = 0;

    this.writableState.set({
      ...initial,
      importPending: true,
      importErrors: [],
      importSummary: null,
    });

    for (const file of files) {
      if (this.importIsStale(generation)) {
        return;
      }

      const validationError = this.validateFileBeforeDecode(file);
      if (validationError !== null) {
        errors.push(validationError);
        this.publishImportErrors(generation, errors);
        continue;
      }

      let url: string;
      try {
        url = URL.createObjectURL(file);
        this.ownedObjectUrls.add(url);
      } catch {
        errors.push(importError(file, 'decode-failed'));
        this.publishImportErrors(generation, errors);
        continue;
      }

      try {
        const dimensions = await decodeImage(url);
        if (this.importIsStale(generation)) {
          this.releaseObjectUrl(url);
          return;
        }

        const current = this.state();
        const image: DeckImage = {
          id: `image-${++this.imageSequence}`,
          name: file.name,
          type: file.type,
          size: file.size,
          lastModified: file.lastModified,
          url,
          width: dimensions.width,
          height: dimensions.height,
          gridPlacement: createCenteredGridPlacement(
            dimensions.width,
            dimensions.height,
          ),
          correctCells: [],
        };
        this.writableState.set({
          ...current,
          deck: [...current.deck, image],
          configurationIndex: current.configurationIndex ?? 0,
        });
        accepted += 1;
      } catch {
        this.releaseObjectUrl(url);
        if (this.importIsStale(generation)) {
          return;
        }
        errors.push(importError(file, 'decode-failed'));
        this.publishImportErrors(generation, errors);
      }
    }

    if (this.importIsStale(generation)) {
      return;
    }

    const summary: ImageImportSummary = {
      attempted: files.length,
      accepted,
      rejected: errors.length,
    };
    const current = this.state();
    this.writableState.set({
      ...current,
      importPending: false,
      importErrors: [...errors],
      importSummary: summary,
    });
  }

  setConfigurationIndex(index: number): void {
    const state = this.state();
    if (
      state.phase !== 'setup' ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= state.deck.length ||
      index === state.configurationIndex
    ) {
      return;
    }
    this.writableState.set({ ...state, configurationIndex: index });
  }

  toggleCorrectCell(imageId: string, cell: CellNumber): void {
    const state = this.state();
    if (state.phase !== 'setup' || !isCellNumber(cell)) {
      return;
    }
    const imageIndex = state.deck.findIndex((image) => image.id === imageId);
    if (imageIndex < 0) {
      return;
    }
    const image = state.deck[imageIndex];
    const correctCells = toggleCell(image.correctCells, cell, true);
    const deck = [...state.deck];
    deck[imageIndex] = { ...image, correctCells };
    this.writableState.set({ ...state, deck });
  }

  toggleCurrentCorrectCell(cell: CellNumber): void {
    const image = this.configurationImage();
    if (image !== null) {
      this.toggleCorrectCell(image.id, cell);
    }
  }

  updateCurrentGridPlacement(placement: GridPlacement): void {
    const state = this.state();
    const imageIndex = state.configurationIndex;
    if (state.phase !== 'setup' || imageIndex === null) {
      return;
    }

    const image = state.deck[imageIndex];
    if (image === undefined) {
      return;
    }

    const gridPlacement = normalizeGridPlacement(
      placement,
      image.width,
      image.height,
    );
    if (gridPlacementsEqual(gridPlacement, image.gridPlacement)) {
      return;
    }

    const deck = [...state.deck];
    deck[imageIndex] = {
      ...image,
      gridPlacement,
    };
    this.writableState.set({ ...state, deck });
  }

  removeImage(imageId: string): void {
    const state = this.state();
    if (state.phase !== 'setup') {
      return;
    }
    const removedIndex = state.deck.findIndex((image) => image.id === imageId);
    if (removedIndex < 0) {
      return;
    }

    const activeImage =
      state.configurationIndex === null ? null : (state.deck[state.configurationIndex] ?? null);
    const removedImage = state.deck[removedIndex];
    const deck = state.deck.filter((image) => image.id !== imageId);
    let configurationIndex: number | null = null;
    if (deck.length > 0) {
      const preservedIndex =
        activeImage === null || activeImage.id === imageId
          ? -1
          : deck.findIndex((image) => image.id === activeImage.id);
      configurationIndex =
        preservedIndex >= 0 ? preservedIndex : Math.min(removedIndex, deck.length - 1);
    }

    this.releaseObjectUrl(removedImage.url);
    this.writableState.set({ ...state, deck, configurationIndex });
  }

  clearDeck(): void {
    const state = this.state();
    if (state.phase !== 'setup') {
      return;
    }
    this.importGeneration += 1;
    this.releaseAllObjectUrls();
    this.writableState.set({
      ...INITIAL_STATE,
      gameName: state.gameName,
      teamNames: state.teamNames,
    });
  }

  startGame(): void {
    const state = this.state();
    if (state.phase !== 'setup' || !this.canStart()) {
      return;
    }
    this.writableState.set({
      ...state,
      phase: 'guessing-first',
      currentImageIndex: 0,
      completedRounds: [],
      round: createRound(state.deck[0].id, 0),
    });
  }

  toggleGuess(cell: CellNumber): void {
    const state = this.state();
    const team = this.activeTeam();
    if (
      (state.phase !== 'guessing-first' && state.phase !== 'guessing-second') ||
      team === null ||
      state.round.locks[team] ||
      !isCellNumber(cell)
    ) {
      return;
    }

    const current = state.round.selections[team];
    const selected = current.includes(cell);
    if (!selected && current.length >= MAX_GUESSES) {
      return;
    }

    const selections = {
      ...state.round.selections,
      [team]: toggleCell(current, cell, false),
    };
    this.writableState.set({
      ...state,
      round: { ...state.round, selections },
    });
  }

  lockActiveTeam(): void {
    const state = this.state();
    const team = this.activeTeam();
    if (
      (state.phase !== 'guessing-first' && state.phase !== 'guessing-second') ||
      team === null ||
      state.round.locks[team] ||
      state.round.selections[team].length !== MAX_GUESSES
    ) {
      return;
    }

    const round: RoundSelection = {
      ...state.round,
      locks: { ...state.round.locks, [team]: true },
    };
    this.writableState.set({
      ...state,
      phase: state.phase === 'guessing-first' ? 'guessing-second' : 'ready-to-reveal',
      round,
    });
  }

  reveal(): void {
    const state = this.state();
    if (state.phase !== 'ready-to-reveal' || !this.canReveal()) {
      return;
    }
    const image = state.deck[state.currentImageIndex];
    if (image === undefined) {
      return;
    }
    const completedRound = completeRound(image, state.round);
    this.writableState.set({
      ...state,
      phase: 'revealed',
      completedRounds: [...state.completedRounds, completedRound],
    });
  }

  advance(): void {
    const state = this.state();
    if (state.phase !== 'revealed' || !this.canAdvance()) {
      return;
    }
    const nextIndex = state.currentImageIndex + 1;
    const nextImage = state.deck[nextIndex];
    if (nextImage === undefined) {
      return;
    }
    this.writableState.set({
      ...state,
      phase: 'guessing-first',
      currentImageIndex: nextIndex,
      round: createRound(nextImage.id, nextIndex),
    });
  }

  finishGame(): void {
    const state = this.state();
    if (state.phase !== 'revealed' || !this.canFinish()) {
      return;
    }
    this.writableState.set({
      ...state,
      phase: 'finished',
      round: null,
    });
  }

  returnToSetup(): void {
    const state = this.state();
    if (state.phase !== 'finished') {
      return;
    }
    this.writableState.set({
      phase: 'setup',
      gameName: state.gameName,
      teamNames: state.teamNames,
      deck: state.deck,
      configurationIndex: state.deck.length > 0 ? 0 : null,
      importPending: false,
      importErrors: [],
      importSummary: null,
      completedRounds: [],
      currentImageIndex: null,
      round: null,
    });
  }

  ngOnDestroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.importGeneration += 1;
    this.releaseAllObjectUrls();
    const state = this.state();
    if (state.importPending) {
      this.writableState.set({ ...state, importPending: false });
    }
  }

  private validateFileBeforeDecode(file: File): ImageImportError | null {
    if (!file.type.toLowerCase().startsWith('image/')) {
      return importError(file, 'not-an-image');
    }
    const key = duplicateKey(file);
    if (this.state().deck.some((image) => duplicateKey(image) === key)) {
      return importError(file, 'likely-duplicate');
    }
    return null;
  }

  private publishImportErrors(generation: number, errors: readonly ImageImportError[]): void {
    if (this.importIsStale(generation)) {
      return;
    }
    const state = this.state();
    this.writableState.set({ ...state, importErrors: [...errors] });
  }

  private importIsStale(generation: number): boolean {
    return (
      this.destroyed ||
      generation !== this.importGeneration ||
      this.state().phase !== 'setup' ||
      !this.state().importPending
    );
  }

  private releaseObjectUrl(url: string): void {
    if (!this.ownedObjectUrls.delete(url)) {
      return;
    }
    URL.revokeObjectURL(url);
  }

  private releaseAllObjectUrls(): void {
    for (const url of [...this.ownedObjectUrls]) {
      this.releaseObjectUrl(url);
    }
  }
}

function createRound(imageId: string, imageIndex: number): RoundSelection {
  return {
    imageId,
    starter: starterForIndex(imageIndex),
    selections: { red: [], blue: [] },
    locks: { red: false, blue: false },
  };
}

function completeRound(
  image: DeckImage,
  round: RoundSelection,
): CompletedRound {
  const correct = new Set(image.correctCells);
  const selected = new Set([...round.selections.red, ...round.selections.blue]);
  const red = completeTeamRound(round.selections.red, correct);
  const blue = completeTeamRound(round.selections.blue, correct);
  return {
    imageId: image.id,
    imageName: image.name,
    correctCells: [...image.correctCells],
    correctUnselected: image.correctCells.filter((cell) => !selected.has(cell)),
    red,
    blue,
  };
}

function completeTeamRound(
  selections: readonly CellNumber[],
  correct: ReadonlySet<CellNumber>,
): CompletedTeamRound {
  const hits = selections.filter((cell) => correct.has(cell));
  return {
    hits,
    misses: selections.filter((cell) => !correct.has(cell)),
    points: hits.length,
  };
}

function bothTeamsAreComplete(round: RoundSelection): boolean {
  return (
    round.locks.red &&
    round.locks.blue &&
    round.selections.red.length === MAX_GUESSES &&
    round.selections.blue.length === MAX_GUESSES
  );
}

function toggleCell(
  cells: readonly CellNumber[],
  cell: CellNumber,
  sort: boolean,
): readonly CellNumber[] {
  if (cells.includes(cell)) {
    return cells.filter((candidate) => candidate !== cell);
  }
  const next = [...cells, cell];
  return sort ? next.sort((left, right) => left - right) : next;
}

function isCellNumber(cell: number): boolean {
  return Number.isInteger(cell) && cell >= FIRST_CELL && cell <= LAST_CELL;
}

function starterForIndex(index: number): Team {
  return index % 2 === 0 ? 'red' : 'blue';
}

function otherTeam(team: Team): Team {
  return team === 'red' ? 'blue' : 'red';
}

function displayName(value: string, fallback: string): string {
  return value.trim() || fallback;
}

function routeForPhase(phase: GamePhase): GameRoute {
  if (phase === 'setup') {
    return 'setup';
  }
  if (phase === 'finished') {
    return 'results';
  }
  return 'play';
}

function duplicateKey(file: Pick<File, 'name' | 'size' | 'type' | 'lastModified'>): string {
  return [
    file.name.trim().toLocaleLowerCase(),
    file.size,
    file.type.toLocaleLowerCase(),
    file.lastModified,
  ].join('\u0000');
}

function importError(
  file: File,
  reason: ImageImportError['reason'],
): ImageImportError {
  const detail: Record<ImageImportError['reason'], string> = {
    'not-an-image': 'is not an image file',
    'likely-duplicate': 'looks like an image already in the deck',
    'decode-failed': 'could not be decoded as an image',
  };
  return {
    fileName: file.name,
    reason,
    message: `${file.name} ${detail[reason]}.`,
  };
}

function decodeImage(url: string): Promise<{ readonly width: number; readonly height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      } else {
        reject(new Error('Decoded image has no intrinsic dimensions.'));
      }
    };
    image.onerror = () => reject(new Error('Image decoding failed.'));
    image.src = url;
  });
}
