import type { Options } from 'semantic-release';

const config: Options = {
  branches: ['main'],
  repositoryUrl: 'https://github.com/Beancount-Trans/Beancount-Trans-Frontend',
  tagFormat: '${version}',
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits'
      }
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'conventionalcommits'
      }
    ],
    [
      '@semantic-release/changelog',
      {
        changelogFile: 'CHANGELOG.md'
      }
    ],
    [
      '@semantic-release/npm',
      {
        npmPublish: false
      }
    ],
    [
      '@semantic-release/git',
      {
        assets: ['package.json', 'package-lock.json', 'CHANGELOG.md'],
        message: 'chore(release): ${nextRelease.version}\n\n${nextRelease.notes}'
      }
    ],
    [
      '@semantic-release/github',
      {
        successComment: false,
        addReleases: 'bottom'
      }
    ]
  ]
};

export default config;

