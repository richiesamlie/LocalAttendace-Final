#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const proc = globalThis.process;
const log = globalThis.console;

const [, , scriptBase, ...scriptArgs] = proc.argv;

if (!scriptBase) {
  log.error("Usage: bun scripts/exec-by-platform.mjs <script-base> [args...]");
  proc.exit(1);
}

const isWin = proc.platform === "win32";
const repoRoot = proc.cwd();

const ps1Path = path.join(repoRoot, `${scriptBase}.ps1`);
const shPath = path.join(repoRoot, `${scriptBase}.sh`);

let cmd = "";
let args = [];

if (isWin) {
  if (!existsSync(ps1Path)) {
    log.error(`Missing Windows script: ${ps1Path}`);
    proc.exit(1);
  }
  cmd = "powershell";
  args = ["-ExecutionPolicy", "Bypass", "-File", ps1Path, ...scriptArgs.map((a) => {
    if (a === "--force") return "-Force";
    if (a === "--backup") return "-Backup";
    return a;
  })];
} else {
  if (!existsSync(shPath)) {
    log.error(`Missing shell script: ${shPath}`);
    proc.exit(1);
  }
  cmd = "bash";
  args = [shPath, ...scriptArgs];
}

const result = spawnSync(cmd, args, {
  stdio: "inherit",
  cwd: repoRoot,
  shell: false,
});

if (typeof result.status === "number") {
  proc.exit(result.status);
}

log.error("Failed to execute platform script");
proc.exit(1);
