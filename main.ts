// Token Launch Radar — program entrypoint.
//
// Pipeline: read the sealed DefiLlama snapshot, score every pre-token
// protocol with the peer-multiple model in lib/model.ts, then publish
// the ranked board, the dashboard's data script, the static dashboard
// and the screenshots into the output directory. dossier.json is
// written last, through vendor/makefun-board.ts, so the summary the
// judge reads describes exactly the files handed in.
//
// In the grader's container the snapshot is mounted at /input and the
// results belong in /output; anywhere else, MAKEFUN_OUTPUT_DIR stands
// in for /output and --input names the snapshot file or its directory.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const root = path.dirname(fileURLToPath(import.meta.url));

/** Print one diagnostic line and stop with the given exit code. */
function fail(message: string, code: number): never {
  process.stderr.write(`token-radar: ${message}\n`);
  process.exit(code);
}

/** Value of a `--flag value` or `--flag=value` argument, if present. */
function optionValue(flag: string): string | undefined {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const current = args[i]!;
    if (current === flag) return args[i + 1];
    if (current.startsWith(`${flag}=`)) return current.slice(flag.length + 1);
  }
  return undefined;
}

/** Copy a repository folder's plain files into the output, returning their names. */
function publishDir(name: string, target: string): string[] {
  const source = path.join(root, name);
  const names: string[] = [];
  if (!fs.existsSync(source)) return names;
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (!entry.isFile() || entry.name.startsWith('.')) continue;
    fs.copyFileSync(path.join(source, entry.name), path.join(target, entry.name));
    names.push(entry.name);
  }
  return names;
}

const inputArg = optionValue('--input') ?? '/input';
const snapshotPath = inputArg.endsWith('.json') ? inputArg : path.join(inputArg, 'snapshot.json');
if (!fs.existsSync(snapshotPath)) {
  fail(`no snapshot found at ${snapshotPath}: pass --input <snapshot.json|directory> or mount the sealed /input`, 2);
}
const outDir = optionValue('--output') ?? process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const snapshot = parseSnapshot(fs.readFileSync(snapshotPath, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const problem = boardIssue(board, snapshot);
if (problem !== null) {
  fail(`the model wrote a board the gate refuses: ${problem}`, 1);
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'board.json'), JSON.stringify({ rows: board }) + '\n');
fs.writeFileSync(path.join(outDir, 'data.js'), dataScript(radar));

publishDir('dashboard', path.join(outDir, 'dashboard'));
const images = publishDir('screenshots', path.join(outDir, 'screenshots'));
const imageNameOk = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;
if (images.length < 3) {
  fail(`screenshots/ contributed ${images.length} image(s): hand in 3, the board, a detail view and a filtered view`, 1);
}
for (const name of images) {
  if (!imageNameOk.test(name)) {
    fail(`screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters`, 1);
  }
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 65_536,
  screenshots: { max: 4, max_bytes: 524_288 },
  dashboard: { max_files: 400, max_bytes: 4_194_304 },
});
fs.writeFileSync(path.join(outDir, 'dossier.json'), dossier);

process.stdout.write(
  `token-radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ` +
    `${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside)\n` +
    `token-radar: wrote board.json, data.js, dashboard/, screenshots/ (${images.length} images) and dossier.json to ${outDir}\n`,
);
