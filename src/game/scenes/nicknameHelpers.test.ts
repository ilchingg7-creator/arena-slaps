import { describe, expect, it } from "vitest";

import { resolveNicknames } from "./nicknameHelpers";

describe("resolveNicknames", () => {
  it("1P mode: returns { player, opponent: botNickname }", () => {
    const result = resolveNicknames(
      "1p-vs-bot",
      "Alice",
      "SlapDuck",
      undefined,
    );
    expect(result).toEqual({ player: "Alice", opponent: "SlapDuck" });
  });

  it("1P mode with no botNickname: falls back to 'Bot'", () => {
    const result = resolveNicknames(
      "1p-vs-bot",
      "Alice",
      undefined,
      undefined,
    );
    expect(result).toEqual({ player: "Alice", opponent: "Bot" });
  });

  it("2P mode: returns { player, opponent: player2Nickname }", () => {
    const result = resolveNicknames(
      "2p-local",
      "Alice",
      undefined,
      "SlapGod",
    );
    expect(result).toEqual({ player: "Alice", opponent: "SlapGod" });
  });

  it("2P mode with no player2Nickname: falls back to 'Player 2'", () => {
    const result = resolveNicknames(
      "2p-local",
      "Alice",
      undefined,
      undefined,
    );
    expect(result).toEqual({ player: "Alice", opponent: "Player 2" });
  });
});
