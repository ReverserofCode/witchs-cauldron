export interface BirthdayConfig {
  name: string;
  month: number;
  day: number;
  timezone: string;
}

export const BIRTHDAY_CONFIG: BirthdayConfig = {
  name: "모잉",
  month: 11,
  day: 24,
  timezone: "Asia/Seoul",
};

function getDatePartsInTimezone(date: Date, timezone: string): { month: number; day: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const monthPart = parts.find((part) => part.type === "month")?.value;
  const dayPart = parts.find((part) => part.type === "day")?.value;

  return {
    month: Number(monthPart),
    day: Number(dayPart),
  };
}

export function isBirthdayToday(date: Date = new Date(), config: BirthdayConfig = BIRTHDAY_CONFIG): boolean {
  const { month, day } = getDatePartsInTimezone(date, config.timezone);
  return month === config.month && day === config.day;
}

export function getBirthdayBannerCopy(config: BirthdayConfig = BIRTHDAY_CONFIG): string {
  return `🎂 오늘은 ${config.name}의 생일! 함께 축하해요.`;
}
