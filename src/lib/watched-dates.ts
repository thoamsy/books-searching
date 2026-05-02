const DATE_TIME_FORMAT = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
});

const MONTH_FORMAT = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
});

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function todayDateValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatWatchedDay(value: string) {
  return DATE_TIME_FORMAT.format(parseDateOnly(value));
}

export function formatWatchedMonth(value: string) {
  return MONTH_FORMAT.format(parseDateOnly(value));
}

export function getWatchedMonthKey(value: string) {
  return value.slice(0, 7);
}
