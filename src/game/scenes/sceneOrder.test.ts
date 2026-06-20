import { describe, expect, it } from "vitest";
import { sceneClasses } from "../gameConfig";

describe("sceneClasses", () => {
  it("starts with BootScene and includes MenuScene", () => {
    expect(sceneClasses[0].name).toBe("BootScene");
    expect(sceneClasses.some((scene) => scene.name === "MenuScene")).toBe(true);
  });
});
