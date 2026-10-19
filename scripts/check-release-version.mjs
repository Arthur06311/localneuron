// Fail when the release tag, package.json version and CHANGELOG section disagree.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const HEADING_PATTERN = /^## \[([^\]]+)\](?: [—–-] (\d{4}-\d{2}-\d{2}))?\s*$/;

export function readPackageVersion(packageJson) {
  const version = packageJson?.version;
  if (typeof version !== 'string' || !VERSION_PATTERN.test(version)) {
    throw new Error('Versão inválida em package.json. Use X.Y.Z ou X.Y.Z-sufixo, por exemplo 0.27.0.');
  }
  return version;
}

export function changelogSections(markdown) {
  const lines = String(markdown).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const sections = [];
  let current = null;
  for (const line of lines) {
    const match = HEADING_PATTERN.exec(line);
    if (match) {
      if (current) sections.push(current);
      current = { version: match[1], date: match[2] ?? null, lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);
  return sections;
}

export function checkReleaseFiles({ version, changelog, tag = null }) {
  const resolved = readPackageVersion({ version });
  const sections = changelogSections(changelog).filter(section => section.version === resolved);
  if (sections.length === 0) {
    throw new Error(`CHANGELOG.md não tem a seção ## [${resolved}]. A tag, package.json e o changelog precisam ser a mesma versão.`);
  }
  if (sections.length > 1) {
    throw new Error(`CHANGELOG.md tem mais de uma seção ## [${resolved}].`);
  }
  const section = sections[0];
  if (!section.date) {
    throw new Error(`A seção ## [${resolved}] precisa da data no formato ## [${resolved}] - AAAA-MM-DD.`);
  }
  const body = section.lines.slice(1).join('\n').trim();
  if (!body) {
    throw new Error(`A seção ## [${resolved}] está vazia. Escreva as notas que vão para a release.`);
  }
  const notes = section.lines.join('\n').trim() + '\n';
  if (tag != null && tag !== '') {
    const expected = `v${resolved}`;
    if (tag !== expected) {
      throw new Error(`A tag ${tag} não bate com a versão ${resolved} de package.json nem com a seção ## [${resolved}] do changelog. O esperado é ${expected}.`);
    }
  }
  return { version: resolved, tag: tag || null, notes };
}

function parseArgs(argv) {
  const args = { tag: undefined, notesFile: null, githubOutput: false, root: null, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help') args.help = true;
    else if (arg === '--github-output') args.githubOutput = true;
    else if (arg === '--tag') args.tag = requiredValue(argv, ++index, arg);
    else if (arg === '--notes-file') args.notesFile = requiredValue(argv, ++index, arg);
    else if (arg === '--root') args.root = requiredValue(argv, ++index, arg);
    else throw new Error(`Argumento desconhecido: ${arg}`);
  }
  return args;
}

function requiredValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith('--')) throw new Error(`Informe o valor de ${flag}.`);
  return value;
}

function tagFromEnvironment() {
  const explicit = process.env.RELEASE_TAG_INPUT?.trim();
  if (explicit) return explicit;
  const ref = process.env.GITHUB_REF || '';
  if (ref.startsWith('refs/tags/')) return ref.slice('refs/tags/'.length);
  // workflow_dispatch without a tag builds the selected commit and publishes nothing.
  return null;
}

function assertHeadMatchesTag(tag) {
  if (!VERSION_PATTERN.test(tag.slice(1)) || !tag.startsWith('v')) {
    throw new Error(`Tag inválida: ${tag}. Use vX.Y.Z, igual à versão do package.json.`);
  }
  let tagged;
  try {
    tagged = execFileSync('git', ['rev-parse', '--verify', `refs/tags/${tag}^{}`], { encoding: 'utf8' }).trim();
  } catch {
    throw new Error(`A tag ${tag} não existe neste clone. Envie-a com git push origin ${tag}. O disparo manual não cria tag, para o workflow não rodar duas vezes.`);
  }
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (tagged !== head) {
    throw new Error(`A tag ${tag} não aponta para este commit. Rode o workflow a partir dessa tag ou informe a tag no disparo manual.`);
  }
  return head;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Uso: node scripts/check-release-version.mjs [--tag vX.Y.Z] [--notes-file arquivo] [--github-output] [--root pasta]');
    return;
  }
  const root = resolve(args.root || process.cwd());
  const version = readPackageVersion(JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')));
  const changelog = readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8');
  const tag = args.tag !== undefined ? args.tag : tagFromEnvironment();
  const result = checkReleaseFiles({ version, changelog, tag });
  let sha = null;
  if (args.githubOutput) {
    if ((process.env.RELEASE_EVENT || '') === 'push' && !result.tag) {
      throw new Error('A release precisa de uma tag vX.Y.Z.');
    }
    sha = result.tag ? assertHeadMatchesTag(result.tag) : execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const output = process.env.GITHUB_OUTPUT;
    if (!output) throw new Error('GITHUB_OUTPUT não está definido.');
    appendFileSync(output, `tag=${result.tag ?? ''}\nversion=${result.version}\nsha=${sha}\n`);
  }
  if (args.notesFile) writeFileSync(args.notesFile, result.notes);
  console.log(result.tag
    ? `Versão conferida: tag ${result.tag}, package.json ${result.version}, changelog ## [${result.version}].`
    : `Versão conferida: package.json ${result.version} tem a seção ## [${result.version}] no changelog.`);
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
