import { formatTime } from "./utils";

let startDate: Date | null;

export function setUptime() {
  if (!startDate) {
    startDate = new Date();
  }
}

export function getUptime() {
  const time = startDate ? new Date().getTime() - startDate.getTime() : 0;
  return formatTime(time);
}
