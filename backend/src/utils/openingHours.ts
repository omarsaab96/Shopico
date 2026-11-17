export interface OpeningSlot { day: number; start: string; end: string }
export interface OpeningStatus { isOpen: boolean; nextOpeningAt: string | null; timeZone: string }
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

// Slots belong to their opening day (Sunday = 0). An earlier end is the next day.
export function getOpeningStatus(branch: { openingHours?: OpeningSlot[]; timeZone?: string }, now = new Date()): OpeningStatus {
  const timeZone = branch.timeZone || "Asia/Damascus";
  const slots = branch.openingHours;
  if (slots === undefined) return { isOpen: true, nextOpeningAt: null, timeZone };
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const localEpoch = (date: Date) => {
    const parts = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]));
    return Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!, +parts.second!);
  };
  const local = new Date(localEpoch(now));
  const dayStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const toInstant = (wall: number) => {
    let instant = wall;
    for (let i = 0; i < 4; i++) instant += wall - localEpoch(new Date(instant));
    return instant;
  };
  let next = Infinity;
  for (let offset = -1; offset <= 7; offset++) {
    const date = dayStart + offset * 86400000;
    const day = new Date(date).getUTCDay();
    for (const slot of slots.filter(s => s.day === day)) {
      const start = toInstant(date + minutes(slot.start) * 60000);
      const end = toInstant(date + (minutes(slot.end) + (slot.end < slot.start ? 1440 : 0)) * 60000);
      if (now.getTime() >= start && now.getTime() < end) return { isOpen: true, nextOpeningAt: null, timeZone };
      if (start > now.getTime()) next = Math.min(next, start);
    }
  }
  return { isOpen: false, nextOpeningAt: Number.isFinite(next) ? new Date(next).toISOString() : null, timeZone };
}
