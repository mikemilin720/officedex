import { describe, expect, it } from "vitest";
import { moveWaiting2048Game, startWaiting2048Game, type Waiting2048GameState } from "./waiting2048Engine";

const noRandomTile = () => 0;

describe("waiting 2048 engine", () => {
  it("starts a game with two tiles", () => {
    const game = startWaiting2048Game(noRandomTile);

    expect(game.score).toBe(0);
    expect(game.gameStatus).toBe("STARTED");
    expect(game.board.flat().filter((value) => value > 0)).toEqual([2, 2]);
  });

  it("merges each tile once per move and adds the merge score", () => {
    const game: Waiting2048GameState = {
      board: [
        [2, 2, 2, 0],
        [4, 4, 8, 8],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      score: 10,
      gameStatus: "STARTED",
    };

    const moved = moveWaiting2048Game("LEFT", game, noRandomTile);

    expect(moved.score).toBe(38);
    expect(moved.board[0].slice(0, 2)).toEqual([4, 2]);
    expect(moved.board[1].slice(0, 2)).toEqual([8, 16]);
  });

  it("does not add a tile when a move does not change the board", () => {
    const game: Waiting2048GameState = {
      board: [
        [2, 4, 8, 16],
        [32, 64, 128, 256],
        [512, 1024, 2, 4],
        [8, 16, 32, 64],
      ],
      score: 99,
      gameStatus: "STARTED",
    };

    const moved = moveWaiting2048Game("LEFT", game, noRandomTile);

    expect(moved.board).toEqual(game.board);
    expect(moved.score).toBe(99);
    expect(moved.gameStatus).toBe("GAME_OVER");
  });
});
