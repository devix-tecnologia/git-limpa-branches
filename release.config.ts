import type { Config } from 'semantic-release';

const config: Config = {
  // @ts-expect-error - semantic-release aceita branches, mas os tipos não reconhecem. A interface Config da lib (ou do pacote de tipos) não inclui branches, mesmo sendo um campo documentado e aceito normalmente pelo semantic-release. Essa divergência já foi reportada várias vezes, mas a lib ainda não atualizou os tipos de forma completa.
  branches: ['main'],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    '@semantic-release/changelog',
    [
      '@semantic-release/npm',
      {
        npmPublish: true,
        tarballDir: 'release',
      },
    ],
    '@semantic-release/github',
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json'],
        message:
          'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
  ],
};

export default config;
  