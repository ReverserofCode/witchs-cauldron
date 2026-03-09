import { describe, expect, it } from "vitest";
import { BIRTHDAY_CONFIG, getBirthdayBannerCopy, isBirthdayToday } from "./birthday";

describe("birthday util", () => {
  it("detects birthday using Asia/Seoul date", () => {
    const birthdayInKst = new Date(Date.UTC(2026, 10, 23, 15, 0, 0));
    const nonBirthdayInKst = new Date(Date.UTC(2026, 10, 23, 14, 59, 59));

    expect(isBirthdayToday(birthdayInKst, BIRTHDAY_CONFIG)).toBe(true);
    expect(isBirthdayToday(nonBirthdayInKst, BIRTHDAY_CONFIG)).toBe(false);
  });

  it("returns korean celebration copy", () => {
    expect(getBirthdayBannerCopy(BIRTHDAY_CONFIG)).toContain("오늘은 모잉의 생일");
  });
});
