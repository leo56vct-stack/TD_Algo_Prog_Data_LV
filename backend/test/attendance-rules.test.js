import assert from "node:assert/strict";
import test from "node:test";
import {
  getEffectiveAttendance,
  getResponseDeadline,
  isResponseEditable,
} from "../src/attendance-rules.js";

const trainingStartsAt = new Date("2026-11-10T18:00:00.000Z");
const responseDeadline = new Date("2026-11-09T18:00:00.000Z");

test("computes the deadline 24 hours before the training", () => {
  assert.equal(getResponseDeadline(trainingStartsAt).toISOString(), responseDeadline.toISOString());
});

test("allows changes before the deadline but locks them at the deadline", () => {
  assert.equal(isResponseEditable(trainingStartsAt, new Date(responseDeadline.getTime() - 1)), true);
  assert.equal(isResponseEditable(trainingStartsAt, responseDeadline), false);
});

test("counts a missing response as pending before the deadline", () => {
  assert.equal(getEffectiveAttendance(null, trainingStartsAt, new Date(responseDeadline.getTime() - 1)), "pending");
});

test("counts a missing response as absent at the deadline", () => {
  assert.equal(getEffectiveAttendance(null, trainingStartsAt, responseDeadline), "absent");
});

test("preserves an explicit response after the deadline", () => {
  assert.equal(getEffectiveAttendance("present", trainingStartsAt, responseDeadline), "present");
  assert.equal(getEffectiveAttendance("absent", trainingStartsAt, responseDeadline), "absent");
});