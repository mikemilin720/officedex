import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadWaiting2048BestScore, saveWaiting2048BestScore, WAITING_2048_STORAGE_KEY } from "./waiting2048Storage";

describe("waiting 2048 storage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns zero when no best score is stored", () => {
    expect(loadWaiting2048BestScore()).toBe(0);
  });

  it("ignores corrupted storage values", () => {
    localStorage.setItem(WAITING_2048_STORAGE_KEY, "{not json");

    expect(loadWaiting2048BestScore()).toBe(0);
  });

  it("only replaces the stored best score when the new score is higher", () => {
    saveWaiting2048BestScore(512);
    saveWaiting2048BestScore(128);

    expect(loadWaiting2048BestScore()).toBe(512);

    saveWaiting2048BestScore(1024);

    expect(loadWaiting2048BestScore()).toBe(1024);
  });
});
