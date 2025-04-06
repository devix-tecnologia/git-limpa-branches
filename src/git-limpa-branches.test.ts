import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import { GitLimpaBranchesService } from './git-limpa-branches-service.js';

// Mock para child_process.execSync
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

// Mock para readline
vi.mock('readline', () => ({
  createInterface: vi.fn(() => ({
    question: vi.fn((pergunta, callback) => callback('resposta do usuario')),
    close: vi.fn(),
  })),
}));

describe('GitLimpaBranchesService', () => {
  // Cria uma instância do serviço para testes
  const branchesProtegidos = ['main', 'master', 'develop'];
  let service: GitLimpaBranchesService;

  // Configura o serviço antes de cada teste
  beforeEach(() => {
    vi.clearAllMocks();
    service = new GitLimpaBranchesService(branchesProtegidos);
  });

  describe('executarGit', () => {
    it('deve executar comando git com sucesso', () => {
      vi.mocked(execSync).mockReturnValue('resultado do comando');
      
      const resultado = service.executarGit('git status');
      
      expect(execSync).toHaveBeenCalledWith('git status', { encoding: 'utf8' });
      expect(resultado).toBe('resultado do comando');
    });

    it('deve retornar mensagem de erro quando silencioso=true', () => {
      const erro = new Error('comando falhou');
      vi.mocked(execSync).mockImplementation(() => { throw erro; });
      
      const resultado = service.executarGit('git comando-invalido', true);
      
      expect(resultado).toBe(erro.message);
    });

    it('deve lançar erro quando silencioso=false', () => {
      const erro = new Error('comando falhou');
      vi.mocked(execSync).mockImplementation(() => { throw erro; });
      
      expect(() => service.executarGit('git comando-invalido')).toThrow();
    });
  });

  describe('obterBranchesRemotos', () => {
    it('deve retornar lista de branches remotos formatada corretamente', () => {
      vi.mocked(execSync).mockReturnValue('  origin/main\n  origin/feature-1\n  origin/HEAD -> origin/main\n  origin/feature-2\n');
      
      const resultado = service.obterBranchesRemotos();
      
      expect(resultado).toEqual(['main', 'feature-1', 'feature-2']);
    });

    it('deve retornar lista vazia quando não houver branches remotos', () => {
      vi.mocked(execSync).mockReturnValue('');
      
      const resultado = service.obterBranchesRemotos();
      
      expect(resultado).toEqual([]);
    });
  });

  describe('obterBranchesLocais', () => {
    it('deve retornar lista de branches locais', () => {
      vi.mocked(execSync).mockReturnValue('  main\n* feature-1\n  feature-2');
      
      const resultado = service.obterBranchesLocais();
      
      expect(resultado).toEqual(['main', 'feature-1', 'feature-2']);
    });

    it('deve remover o asterisco do branch atual', () => {
      vi.mocked(execSync).mockReturnValue('  branch-1\n* branch-atual\n  branch-2');
      
      const resultado = service.obterBranchesLocais();
      
      expect(resultado).toEqual(['branch-1', 'branch-atual', 'branch-2']);
    });
  });

  describe('temAlteracoesNaoMescladas', () => {
    it('deve retornar true quando branch tem alterações não mescladas', () => {
      // Mock para verificação da existência do branch
      vi.mocked(execSync).mockImplementation((comando: string) => {
        if (typeof comando === 'string') {
          if (comando.includes('show-ref')) {
            return ''; // Branch existe
          }
          if (comando.includes('git log')) {
            return 'abc123 Commit não mesclado'; // Encontrou commits não mesclados
          }
        }
        return '';
      });
      
      const resultado = service.temAlteracoesNaoMescladas('feature-branch');
      
      expect(resultado).toBe(true);
    });

    it('deve retornar false quando branch não tem alterações não mescladas', () => {
      // Mock para verificação sem alterações
      vi.mocked(execSync).mockImplementation((comando: string) => {
        if (typeof comando === 'string') {
          if (comando.includes('show-ref')) {
            return ''; // Branch existe
          }
          if (comando.includes('git log')) {
            return ''; // Não há commits não mesclados
          }
        }
        return '';
      });
      
      const resultado = service.temAlteracoesNaoMescladas('feature-branch');
      
      expect(resultado).toBe(false);
    });

    it('deve verificar todos os branches protegidos', () => {
      vi.mocked(execSync).mockReturnValue('');
      
      service.temAlteracoesNaoMescladas('feature-branch');
      
      // Verifica se foi chamado para cada branch protegido
      branchesProtegidos.forEach((branch) => {
        expect(execSync).toHaveBeenCalledWith(
          expect.stringContaining(branch),
          expect.anything(),
        );
      });
    });
  });

  describe('fazerPergunta', () => {
    it('deve criar interface de readline e retornar a resposta', async () => {
      const resultado = await service.fazerPergunta('Confirma?');
      expect(resultado).toBe('resposta do usuario');
    });
  });

  describe('analisarBranchesGit', () => {
    it('deve retornar objeto com resultados da análise', async () => {
      // Mock para confirmarEExecutar
      vi.spyOn(service, 'confirmarEExecutar').mockResolvedValue(true);
      
      // Mock para obter branches
      vi.spyOn(service, 'obterBranchesLocais').mockReturnValue(['main', 'feature-1', 'feature-2']);
      vi.spyOn(service, 'obterBranchesRemotos').mockReturnValue(['main', 'feature-1', 'feature-3']);
      
      // Mock para verificar alterações
      vi.spyOn(service, 'temAlteracoesNaoMescladas')
        .mockReturnValueOnce(false) // feature-1
        .mockReturnValueOnce(true); // feature-2
      
      // Mock para fazerPergunta (pular análise de branches remotos)
      vi.spyOn(service, 'fazerPergunta').mockResolvedValue('n');
      
      const resultado = await service.analisarBranchesGit();
      
      expect(resultado.branchesParaExcluir).toContain('feature-1');
      expect(resultado.branchesComAlteracoes).toContain('feature-2');
      expect(resultado.infoRemotoLocal).toHaveProperty('feature-1');
      expect(resultado.infoRemotoLocal).toHaveProperty('feature-2');
      expect(resultado.infoRemotoLocal).toHaveProperty('feature-3');
    });
  });

  describe('excluirBranches', () => {
    it('deve solicitar confirmação antes de excluir branches', async () => {
      // Criar um resultado de análise de teste
      const resultadoAnalise = {
        branchesParaExcluir: ['feature-1', 'feature-2'],
        branchesComAlteracoes: ['feature-3'],
        infoRemotoLocal: {
          'feature-1': { existeLocal: true, existeRemoto: true },
          'feature-2': { existeLocal: true, existeRemoto: false },
          'feature-3': { existeLocal: true, existeRemoto: true },
        },
      };
      
      // Mock para fazerPergunta (confirmação geral)
      vi.spyOn(service, 'fazerPergunta').mockResolvedValue('s');
      
      // Mock para confirmarEExecutar
      vi.spyOn(service, 'confirmarEExecutar').mockResolvedValue(true);
      
      const resultado = await service.excluirBranches(resultadoAnalise);
      
      expect(resultado).toBe(true);
      expect(service.confirmarEExecutar).toHaveBeenCalledTimes(3); // 1x local + 1x remoto para feature-1, 1x local para feature-2
    });
    
    it('deve cancelar exclusão se usuário não confirmar', async () => {
      const resultadoAnalise = {
        branchesParaExcluir: ['feature-1'],
        branchesComAlteracoes: [],
        infoRemotoLocal: {
          'feature-1': { existeLocal: true, existeRemoto: true },
        },
      };
      
      // Usuário responde 'n' (não) na confirmação geral
      vi.spyOn(service, 'fazerPergunta').mockResolvedValue('n');
      
      // Precisamos criar o spy mesmo que não seja chamado
      const confirmarSpy = vi.spyOn(service, 'confirmarEExecutar');
      
      const resultado = await service.excluirBranches(resultadoAnalise);
      
      expect(resultado).toBe(false);
      expect(confirmarSpy).not.toHaveBeenCalled();
    });
  });
});