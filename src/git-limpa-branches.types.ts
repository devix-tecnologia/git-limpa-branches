/**
 * @fileoverview Definições de tipos para o utilitário git-limpa-branches
 */

/**
 * Representa as cores disponíveis para saída no console
 * @typedef Cores
 * @property {string} vermelho - Código ANSI para texto vermelho
 * @property {string} verde - Código ANSI para texto verde
 * @property {string} amarelo - Código ANSI para texto amarelo
 * @property {string} azul - Código ANSI para texto azul
 * @property {string} reset - Código ANSI para resetar a formatação
 */
export interface Cores {
  readonly vermelho: string;
  readonly verde: string;
  readonly amarelo: string;
  readonly azul: string;
  readonly reset: string;
}

/**
 * Informações sobre a existência de um branch no repositório local e remoto
 * @typedef BranchInfo
 * @property {boolean} existeLocal - Indica se o branch existe no repositório local
 * @property {boolean} existeRemoto - Indica se o branch existe no repositório remoto
 */
export interface BranchInfo {
  existeLocal: boolean;
  existeRemoto: boolean;
}

/**
 * Argumentos da linha de comando após processamento
 * @typedef ArgvOptions
 * @property {string} protegidos - Lista de branches protegidos separados por vírgula
 * @property {boolean} [help] - Indica se o usuário solicitou ajuda
 */
export interface ArgvOptions {
  protegidos: string;
  help?: boolean;
  [key: string]: unknown; // Para outras opções que possam ser adicionadas no futuro
}

/**
 * Resultado da análise de branches do repositório
 * @typedef ResultadoAnalise
 * @property {string[]} branchesParaExcluir - Branches que podem ser excluídos com segurança
 * @property {string[]} branchesComAlteracoes - Branches que têm alterações não mescladas
 * @property {Record<string, BranchInfo>} infoRemotoLocal - Informações sobre cada branch
 */
export interface ResultadoAnalise {
  branchesParaExcluir: string[];
  branchesComAlteracoes: string[];
  infoRemotoLocal: Record<string, BranchInfo>;
}

/**
 * Executa um comando git e retorna sua saída
 * @callback ExecutarGitFn
 * @param {string} comando - O comando git a ser executado
 * @param {boolean} [silencioso=false] - Se true, não lança erro em caso de falha
 * @returns {string} A saída do comando
 * @throws {Error} Se o comando falhar e silencioso for false
 */
export type ExecutarGitFn = (comando: string, silencioso?: boolean) => string;

/**
 * Verifica se um branch tem alterações não mescladas em relação aos branches protegidos
 * @callback TemAlteracoesNaoMescladasFn
 * @param {string} branch - O nome do branch a verificar
 * @returns {boolean} True se o branch tem alterações não mescladas
 */
export type TemAlteracoesNaoMescladasFn = (branch: string) => boolean;

/**
 * Obtém todos os branches remotos
 * @callback ObterBranchesRemotosFn
 * @returns {string[]} Lista de branches remotos
 */
export type ObterBranchesRemotosFn = () => string[];

/**
 * Obtém todos os branches locais
 * @callback ObterBranchesLocaisFn
 * @returns {string[]} Lista de branches locais
 */
export type ObterBranchesLocaisFn = () => string[];

/**
 * Faz uma pergunta ao usuário e retorna a resposta
 * @callback FazerPerguntaFn
 * @param {string} pergunta - A pergunta a ser feita
 * @returns {Promise<string>} A resposta do usuário
 */
export type FazerPerguntaFn = (pergunta: string) => Promise<string>;

/**
 * Solicita confirmação do usuário para executar um comando
 * @callback ConfirmarEExecutarFn
 * @param {string} mensagem - A mensagem explicando o que será feito
 * @param {string} comando - O comando a ser executado
 * @returns {Promise<boolean>} True se o usuário confirmou, false caso contrário
 */
export type ConfirmarEExecutarFn = (mensagem: string, comando: string) => Promise<boolean>;

/**
 * Função principal do programa
 * @callback MainFn
 * @returns {Promise<void>}
 */
export type MainFn = () => Promise<void>;

/**
 * Analisa cada branch e determina quais podem ser excluídos
 * @callback AnalisarBranchesGitFn
 * @returns {Promise<ResultadoAnalise>} Resultado da análise
 */
export type AnalisarBranchesGitFn = () => Promise<ResultadoAnalise>;

/**
 * Realiza a exclusão dos branches identificados como seguros para excluir
 * @callback ExcluirBranchesFn
 * @param {ResultadoAnalise} resultado - O resultado da análise de branches
 * @returns {Promise<boolean>} True se a exclusão foi bem-sucedida para todos os branches
 */
export type ExcluirBranchesFn = (resultado: ResultadoAnalise) => Promise<boolean>;

/**
 * Interface que define o contrato para o serviço de limpeza de branches Git
 * @interface IGitLimpaBranchesService
 */
export interface IGitLimpaBranchesService {
  /**
   * Executa um comando git e retorna sua saída
   * @param comando - O comando git a ser executado
   * @param silencioso - Se true, não lança erro em caso de falha
   * @returns A saída do comando
   * @throws Error Se o comando falhar e silencioso for false
   */
  executarGit: ExecutarGitFn;

  /**
   * Verifica se um branch tem alterações não mescladas em relação aos branches protegidos
   * @param branch - O nome do branch a verificar
   * @returns True se o branch tem alterações não mescladas
   */
  temAlteracoesNaoMescladas: TemAlteracoesNaoMescladasFn;

  /**
   * Obtém todos os branches remotos
   * @returns Lista de branches remotos
   */
  obterBranchesRemotos: ObterBranchesRemotosFn;

  /**
   * Obtém todos os branches locais
   * @returns Lista de branches locais
   */
  obterBranchesLocais: ObterBranchesLocaisFn;

  /**
   * Faz uma pergunta ao usuário e retorna a resposta
   * @param pergunta - A pergunta a ser feita
   * @returns A resposta do usuário
   */
  fazerPergunta: FazerPerguntaFn;

  /**
   * Solicita confirmação do usuário para executar um comando
   * @param mensagem - A mensagem explicando o que será feito
   * @param comando - O comando a ser executado
   * @returns True se o usuário confirmou, false caso contrário
   */
  confirmarEExecutar: ConfirmarEExecutarFn;

  /**
   * Analisa cada branch e determina quais podem ser excluídos
   * @returns Resultado da análise
   */
  analisarBranchesGit: AnalisarBranchesGitFn;

  /**
   * Exibe um resumo dos branches que podem ser excluídos e os que têm alterações
   * @param resultado - O resultado da análise de branches
   */
  exibirResumo(resultado: ResultadoAnalise): void;

  /**
   * Realiza a exclusão dos branches identificados como seguros para excluir
   * @param resultado - O resultado da análise de branches
   * @returns True se a exclusão foi bem-sucedida para todos os branches
   */
  excluirBranches: ExcluirBranchesFn;

  /**
   * Função principal que coordena a execução do utilitário
   */
  main(): Promise<void>;

  /**
   * Retorna as cores usadas pelo serviço para formatação do console
   */
  getCores(): Cores;
}
