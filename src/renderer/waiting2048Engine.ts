export type Waiting2048Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";
export type Waiting2048Status = "STARTED" | "WON" | "GAME_OVER";

export interface Waiting2048GameState {
  board: number[][];
  score: number;
  gameStatus: Waiting2048Status;
}

const BOARD_SIZE = 4;
const WIN_TILE = 2048;

export function startWaiting2048Game(random: () => number = Math.random): Waiting2048GameState {
  const emptyBoard = Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => 0));
  return addRandomTile(addRandomTile({ board: emptyBoard, score: 0, gameStatus: "STARTED" }, random), random);
}

export function moveWaiting2048Game(
  direction: Waiting2048Direction,
  game: Waiting2048GameState,
  random: () => number = Math.random,
): Waiting2048GameState {
  if (game.gameStatus === "GAME_OVER") return game;

  const rows = rowsForDirection(game.board, direction);
  let scoreGain = 0;
  const movedRows = rows.map((row) => {
    const result = mergeLine(row);
    scoreGain += result.scoreGain;
    return result.line;
  });
  const movedBoard = boardFromRows(movedRows, direction);
  if (boardsEqual(game.board, movedBoard)) {
    return { ...game, gameStatus: canMove(movedBoard) ? game.gameStatus : "GAME_OVER" };
  }

  const score = game.score + scoreGain;
  const moved: Waiting2048GameState = {
    board: movedBoard,
    score,
    gameStatus: hasTile(movedBoard, WIN_TILE) ? "WON" : game.gameStatus,
  };
  const withTile = addRandomTile(moved, random);
  return canMove(withTile.board) ? withTile : { ...withTile, gameStatus: "GAME_OVER" };
}

function mergeLine(line: number[]): { line: number[]; scoreGain: number } {
  const values = line.filter((value) => value > 0);
  const merged: number[] = [];
  let scoreGain = 0;
  for (let index = 0; index < values.length; index += 1) {
    const current = values[index];
    const next = values[index + 1];
    if (current === next) {
      const value = current * 2;
      merged.push(value);
      scoreGain += value;
      index += 1;
    } else {
      merged.push(current);
    }
  }
  while (merged.length < BOARD_SIZE) merged.push(0);
  return { line: merged, scoreGain };
}

function rowsForDirection(board: number[][], direction: Waiting2048Direction): number[][] {
  if (direction === "LEFT") return cloneBoard(board);
  if (direction === "RIGHT") return cloneBoard(board).map((row) => row.reverse());
  return Array.from({ length: BOARD_SIZE }, (_, column) => {
    const values = Array.from({ length: BOARD_SIZE }, (_, row) => board[row][column]);
    return direction === "DOWN" ? values.reverse() : values;
  });
}

function boardFromRows(rows: number[][], direction: Waiting2048Direction): number[][] {
  if (direction === "LEFT") return cloneBoard(rows);
  if (direction === "RIGHT") return cloneBoard(rows).map((row) => row.reverse());
  const board = Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => 0));
  rows.forEach((rowValues, column) => {
    const values = direction === "DOWN" ? [...rowValues].reverse() : rowValues;
    values.forEach((value, row) => {
      board[row][column] = value;
    });
  });
  return board;
}

function addRandomTile(game: Waiting2048GameState, random: () => number): Waiting2048GameState {
  const empty = emptyCells(game.board);
  if (empty.length === 0) return game;
  const cellIndex = Math.min(empty.length - 1, Math.floor(random() * empty.length));
  const value = random() < 0.9 ? 2 : 4;
  const [row, column] = empty[cellIndex];
  const board = cloneBoard(game.board);
  board[row][column] = value;
  return { ...game, board };
}

function emptyCells(board: number[][]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  board.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (value === 0) out.push([rowIndex, columnIndex]);
    });
  });
  return out;
}

function canMove(board: number[][]): boolean {
  if (emptyCells(board).length > 0) return true;
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      const value = board[row][column];
      if (board[row][column + 1] === value || board[row + 1]?.[column] === value) return true;
    }
  }
  return false;
}

function hasTile(board: number[][], tile: number): boolean {
  return board.some((row) => row.some((value) => value >= tile));
}

function boardsEqual(a: number[][], b: number[][]): boolean {
  return a.every((row, rowIndex) => row.every((value, columnIndex) => value === b[rowIndex][columnIndex]));
}

function cloneBoard(board: number[][]): number[][] {
  return board.map((row) => [...row]);
}
