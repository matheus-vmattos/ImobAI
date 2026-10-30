import { test } from "node:test";
import assert from "node:assert/strict";
import { somarData } from "../src/lib/format.ts";

test("somarData: renovação de 12 meses a partir do fim do contrato", () => {
  assert.equal(somarData("2026-12-15", 12), "2027-12-15");
  assert.equal(somarData("2026-12-15", 0, 1), "2026-12-16");
  assert.equal(somarData("2026-12-31", 0, 1), "2027-01-01");
  assert.equal(somarData("2028-02-29", 12), "2029-03-01");
});
