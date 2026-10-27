const RESPONSE_WINDOW_MS = 24 * 60 * 60 * 1000;

function toTimestamp(value) {
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new RangeError("A valid date is required.");
  }
  return timestamp;
}

export function getResponseDeadline(trainingStartsAt) {
  return new Date(toTimestamp(trainingStartsAt) - RESPONSE_WINDOW_MS);
}

export function isResponseEditable(trainingStartsAt, now = new Date()) {
  return toTimestamp(now) < getResponseDeadline(trainingStartsAt).getTime();
}

export function getEffectiveAttendance(response, trainingStartsAt, now = new Date()) {
  if (response !== null && response !== undefined) {
    if (response !== "present" && response !== "absent") {
      throw new TypeError("Response must be 'present' or 'absent'.");
    }
    return response;
  }

  return isResponseEditable(trainingStartsAt, now) ? "pending" : "absent";
}