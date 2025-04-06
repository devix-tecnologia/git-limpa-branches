#!/usr/bin/env node
/**
 * @fileoverview Ponto de entrada principal do utilitário git-limpa-branches
 */

import minimist from 'minimist';
import type { ParsedArgs } from 'minimist';
import { ArgvOptions } from './git-limpa-branches.types.js';
import { GitLimpaBranchesService } from './git-limpa-branches-service.js';

// Parse argumentos da linha de comando
const parsedArgs: ParsedArgs = minimist(process.argv.slice(2), {
  string: ['protegidos'],
  alias: {
    p: 'protegidos',
    h: 'help',
  },
  default: {
    protegidos: 'main,master,develop',
  },
});

// Converte para nosso tipo personalizado
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

// Branches protegidos (do parâmetro ou padrão)
const BRANCHES_PROTEGIDOS: string[] = argv.protegidos
  .split(',')
  .map((b) => b.trim())
  .filter(Boolean);

// Inicializa o serviço
const gitService = new GitLimpaBranchesService(BRANCHES_PROTEGIDOS);

// Se o arquivo for executado diretamente (não importado como módulo)
if (import.meta.url === `file://${process.argv[1]}`) {
  // Executa a função principal
  gitService.main().catch((erro) => {
    const cores = gitService.getCores();
    console.error(
      `${cores.vermelho}Erro fatal: ${erro instanceof Error ? erro.message : String(erro)}${cores.reset}`,
    );
    process.exit(1);
  });
}

// Exporta o serviço para uso em outros módulos ou testes
export { gitService, BRANCHES_PROTEGIDOS };
