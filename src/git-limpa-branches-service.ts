/**
 * @fileoverview Implementação das funcionalidades principais do git-limpa-branches
 */

import { execSync } from 'child_process';
import { createInterface } from 'readline';
import {
  BranchInfo,
  ExecutarGitFn,
  TemAlteracoesNaoMescladasFn,
  ObterBranchesRemotosFn,
  ObterBranchesLocaisFn,
  FazerPerguntaFn,
  ConfirmarEExecutarFn,
  ResultadoAnalise,
  AnalisarBranchesGitFn,
  ExcluirBranchesFn,
  Cores,
  IGitLimpaBranchesService,
} from './git-limpa-branches.types.js';

/**
 * Classe que implementa os serviços de limpeza de branches do Git
 */
export class GitLimpaBranchesService implements IGitLimpaBranchesService {
  /**
   * Cores para formatação do console
   */
  private readonly cores: Cores = {
    vermelho: '\x1b[31m',
    verde: '\x1b[32m',
    amarelo: '\x1b[33m',
    azul: '\x1b[34m',
    reset: '\x1b[0m',
  };

  /**
   * Cria uma nova instância do serviço
   * @param branchesProtegidos - Lista de branches que não devem ser excluídos
   */
  constructor(private readonly branchesProtegidos: string[]) {
    // Exibe os branches protegidos ao inicializar
    console.log(`${this.cores.azul}Branches protegidos: ${this.branchesProtegidos.join(', ')}${this.cores.reset}\n`);
  }

  /**
   * Executa um comando git e retorna sua saída
   * @param comando - O comando git a ser executado
   * @param silencioso - Se true, não lança erro em caso de falha
   * @returns A saída do comando
   * @throws Error Se o comando falhar e silencioso for false
   */
  public executarGit: ExecutarGitFn = (comando, silencioso = false) => {
    try {
      return execSync(comando, { encoding: 'utf8' }).trim();
    } catch (erro) {
      if (silencioso) {
        return erro instanceof Error ? erro.message : String(erro);
      }
      throw new Error(`Falha ao executar: ${comando}\nErro: ${erro instanceof Error ? erro.message : String(erro)}`);
    }
  };

  /**
   * Verifica se um branch tem alterações não mescladas em relação aos branches protegidos
   * @param branch - O nome do branch a verificar
   * @returns True se o branch tem alterações não mescladas
   */
  public temAlteracoesNaoMescladas: TemAlteracoesNaoMescladasFn = (branch) => {
    for (const branchAlvo of this.branchesProtegidos) {
      // Verifica se o branch de destino existe
      const branchExiste = this.executarGit(
        `git show-ref --verify --quiet refs/heads/${branchAlvo} || echo "nao-existe"`,
        true,
      );

      if (branchExiste !== 'nao-existe') {
        // Verifica se há commits não mesclados
        const commitsNaoMesclados = this.executarGit(`git log ${branchAlvo}..${branch} --oneline`, true);
        if (commitsNaoMesclados && commitsNaoMesclados.length > 0) {
          return true;
        }
      }
    }
    return false;
  };

  /**
   * Obtém todos os branches remotos
   * @returns Lista de branches remotos
   */
  public obterBranchesRemotos: ObterBranchesRemotosFn = () => {
    const branchesRemotos = this.executarGit('git branch -r', true)
      .split('\n')
      .map((b) => b.trim())
      .filter((b) => b.startsWith('origin/'))
      .map((b) => b.replace('origin/', ''))
      .filter((b) => !b.includes('HEAD'))
      .filter(Boolean);

    return branchesRemotos;
  };

  /**
   * Obtém todos os branches locais
   * @returns Lista de branches locais
   */
  public obterBranchesLocais: ObterBranchesLocaisFn = () => {
    return this.executarGit('git branch', true)
      .split('\n')
      .map((b) => b.trim().replace(/^\*\s*/, ''))
      .filter(Boolean);
  };

  /**
   * Faz uma pergunta ao usuário e retorna a resposta
   * @param pergunta - A pergunta a ser feita
   * @returns A resposta do usuário
   */
  public fazerPergunta: FazerPerguntaFn = (pergunta) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) =>
      rl.question(pergunta, (resposta: string) => {
        rl.close();
        resolve(resposta);
      }),
    );
  };

  /**
   * Solicita confirmação do usuário para executar um comando
   * @param mensagem - A mensagem explicando o que será feito
   * @param comando - O comando a ser executado
   * @returns True se o usuário confirmou, false caso contrário
   */
  public confirmarEExecutar: ConfirmarEExecutarFn = async (mensagem, comando) => {
    const resposta = await this.fazerPergunta(`${mensagem} (s/N) `);

    if (resposta.toLowerCase().startsWith('s')) {
      try {
        this.executarGit(comando);
        return true;
      } catch (erro) {
        const mensagemErro =
          erro instanceof Error ? erro.message : String(erro).replace(/Command failed with exit code \d+:/, '');
        console.log(`${this.cores.vermelho}Erro ao executar comando: ${mensagemErro}`);
        return false;
      }
    }

    console.log(`${this.cores.amarelo}Operação cancelada pelo usuário.${this.cores.reset}`);
    return false;
  };

  /**
   * Analisa cada branch e determina quais podem ser excluídos
   * @returns Resultado da análise
   */
  public analisarBranchesGit: AnalisarBranchesGitFn = async () => {
    console.log(`${this.cores.amarelo}Iniciando análise dos branches...${this.cores.reset}\n`);

    // Atualiza a lista de branches remotos
    await this.confirmarEExecutar('Deseja atualizar a lista de branches remotos?', 'git fetch --prune');

    // Obtém todos os branches (locais e remotos)
    const branchesLocais = this.obterBranchesLocais();
    const branchesRemotos = this.obterBranchesRemotos();
    const todosBranches = [...new Set([...branchesLocais, ...branchesRemotos])];

    const branchesParaExcluir: string[] = [];
    const branchesComAlteracoes: string[] = [];
    const infoRemotoLocal: Record<string, BranchInfo> = {};

    // Analisa cada branch
    for (const branch of todosBranches) {
      if (!this.branchesProtegidos.includes(branch)) {
        // Determina se o branch existe local e/ou remotamente
        const existeLocal = branchesLocais.includes(branch);
        const existeRemoto = branchesRemotos.includes(branch);
        infoRemotoLocal[branch] = { existeLocal, existeRemoto };

        // Se o branch não existe localmente, faz checkout temporário para análise
        let branchTemporarioCriado = false;
        if (!existeLocal && existeRemoto) {
          try {
            const resposta = await this.fazerPergunta(
              `Deseja fazer checkout temporário do branch remoto '${branch}' para análise? (s/N) `,
            );

            if (resposta.toLowerCase().startsWith('s')) {
              this.executarGit(`git checkout -b ${branch} origin/${branch}`);
              branchTemporarioCriado = true;
            } else {
              console.log(`${this.cores.amarelo}Pulando análise do branch remoto '${branch}'${this.cores.reset}`);
              continue;
            }
          } catch (erro) {
            const mensagemErro =
              erro instanceof Error ? erro.message : String(erro).replace(/Command failed with exit code \d+:/, '');
            console.log(`${this.cores.vermelho}Erro ao analisar branch remoto '${branch}': ${mensagemErro}`);
            continue;
          }
        }

        if (this.temAlteracoesNaoMescladas(branch)) {
          branchesComAlteracoes.push(branch);
          console.log(`${this.cores.vermelho}Branch '${branch}' tem alterações não mescladas${this.cores.reset}`);
        } else {
          branchesParaExcluir.push(branch);
          console.log(`${this.cores.verde}Branch '${branch}' pode ser excluído com segurança${this.cores.reset}`);
        }

        // Se criamos um branch temporário, removemos ele
        if (branchTemporarioCriado) {
          try {
            await this.confirmarEExecutar(
              `Deseja remover o branch temporário '${branch}'?`,
              `git checkout - && git branch -D ${branch}`,
            );
          } catch {
            console.log(`${this.cores.amarelo}Aviso: Não foi possível limpar o branch temporário${this.cores.reset}.`);
          }
        }
      } else {
        console.log(`${this.cores.azul}Branch '${branch}' está protegido${this.cores.reset}`);
      }
    }

    return { branchesParaExcluir, branchesComAlteracoes, infoRemotoLocal };
  };

  /**
   * Exibe um resumo dos branches que podem ser excluídos e os que têm alterações
   * @param resultado - O resultado da análise de branches
   */
  public exibirResumo(resultado: ResultadoAnalise): void {
    const { branchesParaExcluir, branchesComAlteracoes, infoRemotoLocal } = resultado;

    if (branchesParaExcluir.length === 0) {
      console.log(`\n${this.cores.amarelo}Não há branches seguros para excluir.${this.cores.reset}`);
      return;
    }

    // Mostra resumo
    console.log(`\n${this.cores.amarelo}Resumo:${this.cores.reset}`);
    console.log(`${this.cores.verde}Branches que podem ser excluídos:${this.cores.reset}`);
    branchesParaExcluir.forEach((b) => {
      const info = infoRemotoLocal[b];
      const local = info.existeLocal ? 'local' : '';
      const remoto = info.existeRemoto ? 'remoto' : '';
      const onde = [local, remoto].filter(Boolean).join(' e ');
      console.log(`${b} (${onde})`);
    });

    if (branchesComAlteracoes.length > 0) {
      console.log(`\n${this.cores.vermelho}Branches com alterações não mescladas (serão mantidos):${this.cores.reset}`);
      branchesComAlteracoes.forEach((b) => console.log(b));
    }
  }

  /**
   * Realiza a exclusão dos branches identificados como seguros para excluir
   * @param resultado - O resultado da análise de branches
   * @returns True se a exclusão foi bem-sucedida para todos os branches
   */
  public excluirBranches: ExcluirBranchesFn = async (resultado) => {
    const { branchesParaExcluir, branchesComAlteracoes, infoRemotoLocal } = resultado;

    if (branchesParaExcluir.length === 0) {
      return true;
    }

    // Pede confirmação geral
    const respostaGeral = await this.fazerPergunta('\nDeseja prosseguir com a exclusão dos branches seguros? (s/N) ');

    if (!respostaGeral.toLowerCase().startsWith('s')) {
      console.log(`${this.cores.amarelo}Operação cancelada.${this.cores.reset}`);
      return false;
    }

    // Exclui os branches seguros
    let sucessoTotal = true;
    for (const branch of branchesParaExcluir) {
      const info = infoRemotoLocal[branch];

      // Remove branch local se existir
      if (info.existeLocal) {
        const sucesso = await this.confirmarEExecutar(
          `Deseja excluir o branch local '${branch}'?`,
          `git branch -D ${branch}`,
        );

        if (sucesso) {
          console.log(`${this.cores.verde}Branch local '${branch}' excluído com sucesso${this.cores.reset}`);
        } else {
          sucessoTotal = false;
        }
      }

      // Remove branch remoto se existir
      if (info.existeRemoto) {
        const sucesso = await this.confirmarEExecutar(
          `Deseja excluir o branch remoto '${branch}'?`,
          `git push origin --delete ${branch}`,
        );

        if (sucesso) {
          console.log(`${this.cores.verde}Branch remoto '${branch}' excluído com sucesso${this.cores.reset}`);
        } else {
          sucessoTotal = false;
        }
      }
    }

    if (sucessoTotal) {
      console.log(`\n${this.cores.verde}Limpeza concluída com sucesso!${this.cores.reset}`);
    } else {
      console.log(`\n${this.cores.amarelo}Limpeza concluída com alguns erros.${this.cores.reset}`);
    }

    console.log(
      `${this.cores.amarelo}Branches protegidos mantidos: ${this.branchesProtegidos.join(', ')}${this.cores.reset}`,
    );
    if (branchesComAlteracoes.length > 0) {
      console.log(
        `${this.cores.vermelho}Branches com alterações mantidos: ${branchesComAlteracoes.join(', ')}${this.cores.reset}`,
      );
    }

    return sucessoTotal;
  };

  /**
   * Função principal que coordena a execução do utilitário
   */
  public async main(): Promise<void> {
    try {
      // Analisa os branches
      const resultado = await this.analisarBranchesGit();

      // Exibe o resumo
      this.exibirResumo(resultado);

      // Exclui os branches seguros
      await this.excluirBranches(resultado);
    } catch (erro) {
      console.error(
        `${this.cores.vermelho}Erro fatal: ${erro instanceof Error ? erro.message : String(erro)}${this.cores.reset}`,
      );
      process.exit(1);
    }
  }

  /**
   * Retorna as cores usadas pelo serviço para formatação do console
   */
  public getCores(): Cores {
    return this.cores;
  }
}
