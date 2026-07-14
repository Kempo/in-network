import { expect, test } from "vitest";
const { tokenizeName } = await import("../../src/match/core.js");

test("tokenizeName drops titles + single-char initials", () => {
  expect(tokenizeName("Tiffany Scharschmidt MD")).toEqual(["tiffany", "scharschmidt"]);
  expect(tokenizeName("Dr. Tiffany C. Scharschmidt, M.D.")).toEqual(["tiffany", "scharschmidt"]);
});
