#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const DEFAULT_OUTPUT = path.join(os.homedir(), ".claude", "statusline-snapshot.json");
const outputPath = expandHome(process.env.AGENT_SESSION_SEARCH_CLAUDE_STATUSLINE || DEFAULT_OUTPUT);

let stdin = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  stdin += chunk;
  if (stdin.length > 1024 * 1024) {
    process.stderr.write("Claude statusline input is too large.\n");
    process.exit(1);
  }
});

process.stdin.on("end", () => {
  try {
    const input = stdin.trim() ? JSON.parse(stdin) : {};
    const snapshot = buildSnapshot(input);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    writeJsonAtomic(outputPath, snapshot);
    process.stdout.write(formatStatusline(snapshot));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Could not write Claude statusline snapshot: ${message}\n`);
    process.exit(1);
  }
});

function buildSnapshot(input) {
  const snapshot = {
    source: "agent-session-search-statusline",
    updated_at: new Date().toISOString(),
  };

  const plan = stringField(input, "plan") || stringField(input, "subscription_plan");
  if (plan) snapshot.plan = plan;

  const rateLimits = objectField(input, "rate_limits");
  if (rateLimits) {
    const fiveHour = normalizeWindow(objectField(rateLimits, "five_hour"));
    const sevenDay = normalizeWindow(objectField(rateLimits, "seven_day"));
    if (fiveHour || sevenDay) {
      snapshot.rate_limits = {};
      if (fiveHour) snapshot.rate_limits.five_hour = fiveHour;
      if (sevenDay) snapshot.rate_limits.seven_day = sevenDay;
    }
  }

  return snapshot;
}

function normalizeWindow(value) {
  if (!value) return null;
  const window = {};
  copyNumber(value, window, "used_percentage");
  copyNumber(value, window, "remaining_percentage");
  copyNumber(value, window, "resets_at");
  return Object.keys(window).length > 0 ? window : null;
}

function copyNumber(source, target, key) {
  const value = source[key];
  if (typeof value === "number" && Number.isFinite(value)) target[key] = value;
}

function objectField(value, key) {
  const field = value && typeof value === "object" ? value[key] : undefined;
  return field && typeof field === "object" && !Array.isArray(field) ? field : null;
}

function stringField(value, key) {
  const field = value && typeof value === "object" ? value[key] : undefined;
  return typeof field === "string" && field.trim() ? field.trim() : "";
}

function writeJsonAtomic(filePath, value) {
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(tmpPath, filePath);
}

function formatStatusline(snapshot) {
  const pieces = [];
  const fiveHour = snapshot.rate_limits && snapshot.rate_limits.five_hour;
  const sevenDay = snapshot.rate_limits && snapshot.rate_limits.seven_day;
  if (fiveHour && typeof fiveHour.used_percentage === "number") pieces.push(`5h ${Math.round(100 - fiveHour.used_percentage)}% left`);
  if (sevenDay && typeof sevenDay.used_percentage === "number") pieces.push(`7d ${Math.round(100 - sevenDay.used_percentage)}% left`);
  return pieces.length > 0 ? `${pieces.join(" | ")}\n` : "Claude quota pending\n";
}

function expandHome(value) {
  if (!value.startsWith("~/")) return value;
  return path.join(os.homedir(), value.slice(2));
}
