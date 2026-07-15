import { readFile } from 'node:fs/promises'; import { parseElmResponse } from '@prius/elm327';
const path = process.argv[2];
if (!path) { console.error('Usage: pnpm replay <exported-log.json>'); process.exitCode = 2; }
else { const entries = JSON.parse(await readFile(path, 'utf8')) as Array<{ command?: string; response: string }>; for (const entry of entries) console.log(JSON.stringify(parseElmResponse(entry.response, entry.command))); }
