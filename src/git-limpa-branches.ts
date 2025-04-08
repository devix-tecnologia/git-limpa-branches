#!/usr/bin/env node
/**
 * @fileoverview Ponto de entrada principal do utilitário git-limpa-branches
 */

import minimist, { type ParsedArgs } from 'minimist';
import { fileURLToPath } from 'url';
import { basename } from 'path';
import { ArgvOptions } from './git-limpa-branches.types.js';
import { GitLimpaBranchesService } from './git-limpa-branches-service.js';

// Parse argumentos da linha de comando
const parsedArgs: ParsedArgs = minimist(process.argv.slice(2), {
  string: ['protegidos'],
  alias: { p: 'protegidos', h: 'help' },
  default: { protegidos: 'main,master,develop' },
});

const argv: ArgvOptions = {
  protegidos: parsedArgs.protegidos as string,
  help: !!parsedArgs.help,
  ...parsedArgs,
};

// Mostrar ajuda se solicitado
if (argv.help) {
  const cores = {
    vermelho: '\x1b[31m',
    verde: '\x1b[32m',
    amarelo: '\x1b[33m',
    azul: '\x1b[34m',
    reset: '\x1b[0m',
  };
  console.log(`
${cores.amarelo}Git-Limpa-Branches${cores.reset} - Utilitário para limpeza segura de branches Git
${cores.verde}Uso:${cores.reset}
  git-limpa-branches [opções]
${cores.verde}Opções:${cores.reset}
  -p, --protegidos    Lista de branches protegidos, separados por vírgula
                      Padrão: main,master,develop
  -h, --help          Exibe esta ajuda e sai
${cores.verde}Exemplos:${cores.reset}
  git-limpa-branches
  git-limpa-branches --protegidos=main,producao,homologacao
  git-limpa-branches -p main,release
  `);
  process.exit(0);
}

// Branches protegidos
const BRANCHES_PROTEGIDOS: string[] = argv.protegidos
  .split(',')
  .map((b) => b.trim())
  .filter(Boolean);

// Inicializa o serviço
const gitService = new GitLimpaBranchesService(BRANCHES_PROTEGIDOS);

// Função para determinar se o script está sendo executado como principal
function isRunningAsMainScript(): boolean {
  const currentFilePath = fileURLToPath(import.meta.url);
  const currentFileName = basename(currentFilePath);
  const executedFileName = basename(process.argv[1] || '');

  // Logs para depuração
  console.debug('import.meta.url:', import.meta.url);
  console.debug('process.argv[1]:', process.argv[1]);
  console.debug('currentFileName:', currentFileName);
  console.debug('executedFileName:', executedFileName);
  const isMain = currentFileName === 'git-limpa-branches.js' || executedFileName === 'git-limpa-branches';
  console.log('Condição (isRunningAsMainScript):', isMain);

  return isMain;
}

// Executa main() se for o script principal
if (isRunningAsMainScript()) {
  console.log('Executando main()...');
  gitService.main().catch((erro) => {
    const cores = gitService.getCores();
    console.error(`${cores.vermelho}Erro fatal: ${erro instanceof Error ? erro.message : String(erro)}${cores.reset}`);
    process.exit(1);
  });
}

// Exporta o serviço
export { gitService, BRANCHES_PROTEGIDOS };
