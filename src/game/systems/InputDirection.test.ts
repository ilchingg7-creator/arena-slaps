import { describe, expect, it } from "vitest";
import { combineMovementInput } from "./InputDirection";

describe("InputDirection", () => {
  it("combines keyboard and touch axes", () => {
    expect(
      combineMovementInput(
        { down: false, left: true, right: false, up: false },
        { down: false, left: false, right: true, up: false },
        { down: false, left: false, right: false, up: true },
      ),
    ).toEqual({ x: 0, y: -1 });
  });

  it("returns idle input when nothing is pressed", () => {
    expect(
      combineMovementInput(
        { down: false, left: false, right: false, up: false },
        { down: false, left: false, right: false, up: false },
      ),
    ).toEqual({ x: 0, y: 0 });
  });
});
