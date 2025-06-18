/**
 * Extracts the repository name from a GitHub issue URL
 * Uses the same logic as prepareRepository.ts
 */
export function extractRepositoryName(issueUrl: string): string {
  const issueIndex = issueUrl.indexOf("/issues");
  const repoUrl = issueUrl.substring(0, issueIndex);
  const parts = repoUrl.split("/");
  const repo = parts[parts.length - 1];
  return repo;
}