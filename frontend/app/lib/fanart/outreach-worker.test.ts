import { describe, expect, it } from "vitest";
import { resolve, join } from "node:path";
import { parseOutreachOptions, validatePrivateOutreachPath } from "./outreach-worker";
describe("outreach CLI options", () => {
  it("defaults to a single non-mutating dry run", () => { expect(parseOutreachOptions([])).toMatchObject({ apply: false, sendComments: false, iterations: 1 }); });
  it.each([["--send-comments"], ["--apply", "--send-comments", "--limit", "0"], ["--apply", "--send-comments", "--limit", "6"], ["--poll-seconds", "1", "--iterations", "2"], ["--unknown"], ["--login", "--apply"]].map(flags => ({ flags })))("fails unsafe flags $flags", ({ flags }) => { expect(() => parseOutreachOptions(flags)).toThrow(); });
  it("requires explicit bounded comment allowance and bounded polling", () => {
    expect(parseOutreachOptions(["--once", "--apply", "--send-comments", "--limit", "2", "--poll-seconds", "60", "--iterations", "3"])).toMatchObject({ apply: true, sendComments: true, limit: 2, iterations: 3, pollSeconds: 60 });
  });
  it("keeps browser profiles and configuration outside the repository", () => {
    const root = resolve("project");
    expect(() => validatePrivateOutreachPath(join(root, "profiles", "fanart"), root)).toThrow();
    expect(() => validatePrivateOutreachPath(root, root)).toThrow();
    expect(() => validatePrivateOutreachPath("relative/path", root)).toThrow();
    expect(validatePrivateOutreachPath(resolve("../private-fanart"), root)).toBe(resolve("../private-fanart"));
  });
});
