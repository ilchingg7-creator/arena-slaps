import { describe, expect, it } from "vitest";
import {
  BANNED_WORDS,
  FALLBACK_NICKNAME,
  NICKNAME_COUNT,
  NICKNAMES,
  getRandomNickname,
  getRandomNicknames,
  validateNickname,
} from "./nicknames";

describe("nicknames", () => {
  describe("NICKNAMES list", () => {
    it("has exactly 500 entries", () => {
      expect(NICKNAMES).toHaveLength(500);
    });

    it("all 500 nicknames are unique", () => {
      const set = new Set(NICKNAMES);
      expect(set.size).toBe(500);
    });

    it("all 500 nicknames are non-empty strings", () => {
      NICKNAMES.forEach((n) => {
        expect(typeof n).toBe("string");
        expect(n.length).toBeGreaterThan(0);
      });
    });

    it("all 500 nicknames are ASCII-safe (no non-Latin characters or emojis)", () => {
      // eslint-disable-next-line no-control-regex
      const asciiRegex = /^[\x00-\x7F]+$/;
      NICKNAMES.forEach((n) => {
        expect(asciiRegex.test(n)).toBe(true);
      });
    });

    it("all 500 nicknames pass validateNickname", () => {
      NICKNAMES.forEach((n) => {
        expect(validateNickname(n)).toBe(true);
      });
    });

    it("no nickname contains a banned word (case-insensitive substring)", () => {
      NICKNAMES.forEach((n) => {
        const lower = n.toLowerCase();
        BANNED_WORDS.forEach((word) => {
          expect(lower).not.toContain(word);
        });
      });
    });

    it("NICKNAME_COUNT equals NICKNAMES.length (500)", () => {
      expect(NICKNAME_COUNT).toBe(NICKNAMES.length);
      expect(NICKNAME_COUNT).toBe(500);
    });
  });

  describe("getRandomNickname", () => {
    it("returns a string from the list", () => {
      for (let i = 0; i < 50; i++) {
        const name = getRandomNickname();
        expect(NICKNAMES).toContain(name);
      }
    });

    it("avoids excluded names", () => {
      const exclude = [...NICKNAMES].slice(0, 400);
      const excludeSet = new Set(exclude);
      for (let i = 0; i < 50; i++) {
        const name = getRandomNickname(exclude);
        expect(NICKNAMES).toContain(name);
        expect(excludeSet.has(name)).toBe(false);
      }
    });

    it("returns a fallback when all names are excluded", () => {
      const all = [...NICKNAMES];
      const name = getRandomNickname(all);
      expect(name).toBe(FALLBACK_NICKNAME);
    });

    it("returns a name from the list when exclude is empty", () => {
      const name = getRandomNickname([]);
      expect(NICKNAMES).toContain(name);
    });

    it("returns a name from the list when exclude is undefined", () => {
      const name = getRandomNickname(undefined);
      expect(NICKNAMES).toContain(name);
    });
  });

  describe("getRandomNicknames", () => {
    it("returns 3 unique names for count=3", () => {
      const names = getRandomNicknames(3);
      expect(names).toHaveLength(3);
      expect(new Set(names).size).toBe(3);
      names.forEach((n) => expect(NICKNAMES).toContain(n));
    });

    it("avoids the 2 excluded names for count=5", () => {
      const exclude = [...NICKNAMES].slice(0, 2);
      const excludeSet = new Set(exclude);
      const names = getRandomNicknames(5, exclude);
      expect(names).toHaveLength(5);
      expect(new Set(names).size).toBe(5);
      names.forEach((n) => {
        expect(NICKNAMES).toContain(n);
        expect(excludeSet.has(n)).toBe(false);
      });
    });

    it("returns an empty array for count=0", () => {
      expect(getRandomNicknames(0)).toEqual([]);
    });

    it("returns an empty array for negative count", () => {
      expect(getRandomNicknames(-5)).toEqual([]);
    });

    it("returns at most 500 names when count exceeds list size (count=600)", () => {
      const names = getRandomNicknames(600);
      expect(names.length).toBeLessThanOrEqual(500);
      // All returned names should be unique.
      expect(new Set(names).size).toBe(names.length);
      // And every name should come from the list.
      names.forEach((n) => expect(NICKNAMES).toContain(n));
    });

    it("handles exclude that contains names not in the list", () => {
      const exclude = ["NotInList1", "NotInList2"];
      const names = getRandomNicknames(5, exclude);
      expect(names).toHaveLength(5);
      expect(new Set(names).size).toBe(5);
    });
  });

  describe("validateNickname", () => {
    it("returns false for a name containing a banned word", () => {
      expect(validateNickname("SlapFuck")).toBe(false);
      expect(validateNickname("shitkicker")).toBe(false);
      expect(validateNickname("bitchslap")).toBe(false);
      expect(validateNickname("damnIt")).toBe(false);
    });

    it("returns true for a clean name", () => {
      expect(validateNickname("SlapDuck")).toBe(true);
      expect(validateNickname("PancakePuncher")).toBe(true);
      expect(validateNickname("xX_Slap_Master_Xx")).toBe(true);
      expect(validateNickname("SlapGandalf")).toBe(true);
    });

    it("is case-insensitive", () => {
      expect(validateNickname("SLAPFUCK")).toBe(false);
      expect(validateNickname("ShIt")).toBe(false);
      expect(validateNickname("BiTcH")).toBe(false);
      expect(validateNickname("slapduck")).toBe(true);
      expect(validateNickname("PANCAKEPUNCHER")).toBe(true);
    });
  });
});
