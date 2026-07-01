export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const chunks = value.split("-");
  const year = Number(chunks[0]);
  const month = Number(chunks[1]);
  const day = Number(chunks[2]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function toUtcTimestamp(value: string): number {
  const chunks = value.split("-");
  return Date.UTC(Number(chunks[0]), Number(chunks[1]) - 1, Number(chunks[2]));
}

const MILLISECONDS_PER_DAY = 86400000;

export function calculateInclusiveDays(
  departureDate: string,
  returnDate: string,
): number {
  const departureTimestamp = toUtcTimestamp(departureDate);
  const returnTimestamp = toUtcTimestamp(returnDate);

  return Math.floor((returnTimestamp - departureTimestamp) / MILLISECONDS_PER_DAY) + 1;
}
