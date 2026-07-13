import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../i18n";
import { WAITING_2048_STORAGE_KEY } from "../waiting2048Storage";
import { Waiting2048Game, type Waiting2048Engine, type Waiting2048GameState } from "./Waiting2048Game";

const initialGame: Waiting2048GameState = {
  board: [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 2, 0, 0],
    [0, 0, 0, 2],
  ],
  score: 0,
  gameStatus: "STARTED",
};

const movedGame: Waiting2048GameState = {
  board: [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 4],
  ],
  score: 4,
  gameStatus: "STARTED",
};

function makeEngine(next: Waiting2048GameState = movedGame): Waiting2048Engine {
  return {
    startGame: vi.fn(() => initialGame),
    move: vi.fn(() => next),
  };
}

function renderGame(engine: Waiting2048Engine) {
  return render(
    <LocaleProvider value="en">
      <Waiting2048Game engine={engine} />
    </LocaleProvider>,
  );
}

describe("Waiting2048Game", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("starts collapsed and expands into a playable board", () => {
    renderGame(makeEngine());

    expect(screen.getByRole("button", { name: /play 2048/i })).toBeTruthy();
    expect(screen.queryByRole("grid", { name: /2048 board/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /play 2048/i }));

    expect(screen.getByRole("grid", { name: /2048 board/i })).toBeTruthy();
    expect(screen.getByText("Score")).toBeTruthy();
    expect(screen.getByText("Best")).toBeTruthy();
    expect(screen.getAllByText("2")).toHaveLength(2);
  });

  it("moves with focused keyboard input and updates local best score", () => {
    const engine = makeEngine();
    localStorage.setItem(WAITING_2048_STORAGE_KEY, JSON.stringify({ bestScore: 3 }));
    renderGame(engine);

    fireEvent.click(screen.getByRole("button", { name: /play 2048/i }));
    const panel = screen.getByRole("region", { name: /waiting 2048/i });
    panel.focus();
    fireEvent.keyDown(panel, { key: "ArrowRight" });

    expect(engine.move).toHaveBeenCalledWith("RIGHT", initialGame);
    expect(screen.getByRole("gridcell", { name: "4" })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(WAITING_2048_STORAGE_KEY) ?? "{}")).toEqual({ bestScore: 4 });
  });

  it("supports visible direction controls and shows game over", () => {
    const engine = makeEngine({ ...movedGame, gameStatus: "GAME_OVER" });
    renderGame(engine);

    fireEvent.click(screen.getByRole("button", { name: /play 2048/i }));
    fireEvent.click(screen.getByRole("button", { name: /move up/i }));

    expect(engine.move).toHaveBeenCalledWith("UP", initialGame);
    expect(screen.getByText(/game over/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /restart/i })).toBeTruthy();
  });
});
