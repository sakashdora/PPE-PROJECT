// Generates an isolated PostgreSQL client solely to type-check deployment source.
// Does not connect to PostgreSQL or overwrite the application's SQLite client.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const server = path.join(root, 'server');
const scratch = path.join(__dirname, '.server-review-scratch');
fs.mkdirSync(scratch, { recursive: true });
const schemaPath = path.join(scratch, 'schema.postgresql.prisma');
const source = fs.readFileSync(path.join(server, 'prisma/schema.postgresql.prisma'), 'utf8');
const generatorPath = path.join(server, 'node_modules/@prisma/client/generator-build/index.js').replace(/\\/g, '/');
fs.writeFileSync(schemaPath, source.replace('provider = "prisma-client-js"', `provider = "node ${generatorPath}"\n  output = "./postgres-client"`));
const generated = spawnSync(process.execPath, [path.join(server, 'node_modules/prisma/build/index.js'), 'generate', '--schema', schemaPath], { cwd: server, encoding: 'utf8', env: { ...process.env, PRISMA_GENERATE_SKIP_AUTOINSTALL: '1', DATABASE_URL: 'postgresql://review:review@127.0.0.1:65534/review' } });
console.log(`Isolated PostgreSQL generate exit: ${generated.status}`);
if (generated.status !== 0) { console.error(generated.stdout + generated.stderr); process.exit(generated.status || 1); }
const configPath = path.join(scratch, 'tsconfig.postgresql.json');
fs.writeFileSync(configPath, JSON.stringify({ extends: path.join(server, 'tsconfig.json'), compilerOptions: { incremental: false, noEmit: true, paths: { '@prisma/client': [path.join(scratch, 'postgres-client').replace(/\\/g, '/')] } } }, null, 2));
const checked = spawnSync(process.execPath, [path.join(server, 'node_modules/typescript/bin/tsc'), '-p', configPath], { cwd: server, encoding: 'utf8' });
const report = `Isolated PostgreSQL generated-client TypeScript check\nGenerator exit: ${generated.status}\nTypeScript exit: ${checked.status}\nNo database connection attempted. The original server client was unchanged.\n\n${checked.stdout}${checked.stderr}`;
fs.writeFileSync(path.join(__dirname, 'server-postgres-review-results.txt'), report);
console.log(report);
process.exitCode = checked.status || 0;
