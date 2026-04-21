const COLOMBIA_TIMEZONE = "America/Bogota";

export const getBogotaISODate = () => {
  const formatter = new Intl.DateTimeFormat("en", {
    timeZone: COLOMBIA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return new Date().toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
};

export const getWeekdayFromISODate = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) {
    return new Date().getDay();
  }
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
};
