import type {
  MigrationAgent,
  PortableSession,
  SessionMessage,
  SessionSearchResult,
  SessionSource,
} from "./types";

export const MIGRATION_TOKEN_LIMIT = 60_000;

const MIGRATION_AGENTS = ["claude", "codex", "codebuddy"] as const;

export function migrationAgentForSource(source: SessionSource): MigrationAgent | null {
  switch (source) {
    case "claude-cli":
    case "claude-app":
    case "claude-internal":
      return "claude";
    case "codex-cli":
    case "codex-app":
    case "codex-internal":
      return "codex";
    case "codebuddy-cli":
      return "codebuddy";
    default:
      return null;
  }
}

export function supportedMigrationTargets(source: SessionSource): MigrationAgent[] {
  const sourceAgent = migrationAgentForSource(source);
  return sourceAgent ? MIGRATION_AGENTS.filter((target) => target !== sourceAgent) : [];
}

export function portableSessionFrom(
  session: SessionSearchResult,
  messages: SessionMessage[],
): PortableSession {
  const sourceAgent = migrationAgentForSource(session.source);
  if (!sourceAgent) {
    throw new Error(`Session source ${session.source} cannot be migrated.`);
  }
  if (session.environmentKind !== "local" || session.environmentId !== "local") {
    throw new Error("Remote session migration is not supported yet.");
  }
  if (!session.projectPath.trim()) {
    throw new Error("Session has no project path.");
  }

  const portableMessages = messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message, index) => ({
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
      index,
    }));

  return {
    sourceSessionKey: session.sessionKey,
    sourceAgent,
    title: session.displayTitle,
    projectPath: session.projectPath,
    startedAt: new Date(session.timestamp).toISOString(),
    messages: portableMessages,
  };
}

export function estimatePortableSessionTokens(session: PortableSession): number {
  const characters = session.messages.reduce(
    (total, message) => total + message.content.length,
    0,
  );
  return Math.ceil(characters / 4);
}
