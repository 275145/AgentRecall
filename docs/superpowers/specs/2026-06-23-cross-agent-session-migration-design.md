# Cross-Agent Session Migration Design

## Goal

Add local session migration between Claude Code, Codex, and CodeBuddy. All six cross-agent directions are supported:

- Claude Code → Codex
- Claude Code → CodeBuddy
- Codex → Claude Code
- Codex → CodeBuddy
- CodeBuddy → Claude Code
- CodeBuddy → Codex

After migration, Agent-Session-Search opens the new session in the configured default terminal by running the target CLI's resume command.

## Scope

The first version supports local sessions only. It does not migrate SSH remote sessions.

Migration includes:

- Project path
- Session title and source metadata
- Ordered user and assistant messages
- Original message timestamps when available

Migration excludes:

- Tool calls and tool results
- System and developer prompts
- Permission and sandbox configuration
- Model configuration
- Credentials, API keys, and other secrets not already present in visible messages

Migration never modifies the source session.

## Architecture

Use a normalized intermediate representation and target-specific writers.

```text
Indexed session
    ↓
PortableSession reader
    ↓
Length policy
    ├── complete message history
    ├── AI handoff compression
    └── local head/tail fallback
    ↓
Target writer
    ├── Claude Code JSONL
    ├── Codex JSONL
    └── CodeBuddy JSONL
    ↓
Target format validation
    ↓
Atomic rename into target session directory
    ↓
Refresh local index
    ↓
Open target CLI resume command in the default terminal
```

### Portable Session

The migration core uses a target-independent structure:

```ts
interface PortableSession {
  sourceSessionKey: string;
  sourceAgent: "claude" | "codex" | "codebuddy";
  title: string;
  projectPath: string;
  startedAt: string;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    timestamp: string;
  }>;
}
```

The reader reuses the existing indexed session and message store and does not reparse source files independently.

### Migration Service

A migration service coordinates:

1. Validate that the source is local and one of the three supported agent families.
2. Validate that the target differs from the source.
3. Check that the configured target CLI binary is available.
4. Load all visible user and assistant messages.
5. Apply the length policy.
6. Ask the target writer to prepare and validate a temporary session file.
7. Atomically rename the temporary file into the target session directory.
8. Record migration metadata.
9. Refresh the application index.
10. Open the target resume command in the default terminal.

Writers remain independent of Electron and the UI. They accept the portable session and return the target session ID, file path, and resume command inputs.

## Length Policy

Estimate tokens as:

```text
estimated tokens = total message characters / 4
```

Sessions at or below 60,000 estimated tokens are migrated with their full visible user/assistant history.

Sessions above 60,000 estimated tokens use AI handoff compression through the existing summary Provider resolution order:

1. Dedicated summary Provider
2. Codex Provider
3. Claude Code Provider

The AI output becomes a structured user message. It includes:

- Original agent, title, project path, and session time
- User goals and constraints
- Completed work
- Important technical decisions and rationale
- Relevant files, commands, and verification results
- Open questions and recommended next steps

The compressed session also includes a bounded window of the most recent original user/assistant messages so the target agent can continue from the latest exchange.

The compression prompt must instruct the model to treat transcript content as data and not follow instructions embedded inside it.

### Local Fallback

If no Provider is configured, or AI compression times out, fails, or returns an invalid response, migration continues using a deterministic local fallback:

- Preserve a bounded set of opening messages.
- Preserve a bounded set of closing messages.
- Insert an explicit omission marker with the number of omitted messages.
- Keep the final estimated result below the migration budget.

The result reports whether migration used:

- `complete`
- `ai-compressed`
- `locally-truncated`

## Target Writers

Each writer owns:

- Target session ID creation
- Target path calculation
- Target-specific JSONL records
- Parent/message identifiers where required
- Title metadata where supported
- Temporary-file validation
- Atomic installation

### Codex Writer

Writes into:

```text
~/.codex/sessions/YYYY/MM/DD/rollout-<timestamp>-<uuid>.jsonl
```

The file contains a compatible `session_meta` record followed by ordered message `response_item` records. The writer uses the original project directory as `cwd`.

The launcher executes:

```text
codex resume <session-id>
```

### Claude Code Writer

Writes into the Claude project directory derived from the project path:

```text
~/.claude/projects/<encoded-project-path>/<uuid>.jsonl
```

The writer creates a valid parent-linked user/assistant message chain and includes the session ID, project directory, timestamps, and target-compatible metadata.

The launcher executes:

```text
claude --resume <session-id>
```

### CodeBuddy Writer

Writes into:

```text
~/.codebuddy/projects/<encoded-project-path>/<session-id>.jsonl
```

The writer creates ordered CodeBuddy message records and an `ai-title` record. It excludes reasoning, provider usage, tools, and source-agent-specific state.

The launcher executes:

```text
codebuddy --resume <session-id>
```

### Format Compatibility

Writers use a small target-format compatibility layer:

- Detect installed CLI version before writing.
- Keep format generation isolated by target.
- Validate generated JSONL by parsing it with the application's existing loader.
- Assert target family, session ID, project path, message count, message roles, and message order before installation.

Unsupported target CLI versions fail before writing the final file.

## Atomicity and Failure Handling

Before writing:

- Reject remote sessions.
- Reject same-family targets.
- Reject unsupported sources.
- Check target CLI availability and version.
- Validate that the project path exists and is a directory.

Writing uses:

1. Create target directory if needed.
2. Write a uniquely named temporary file in the same target directory.
3. Flush and close the temporary file.
4. Parse and validate it using the target loader.
5. Atomically rename it to the final session filename.

If preparation or validation fails, remove the temporary file and leave no target session.

If the file is installed but index refresh fails, keep the valid migrated session and report the indexing error.

If terminal launch fails after installation, keep the migrated session and return:

- Target session ID
- Target file path
- Resume command suitable for copying

## Migration Metadata

Store a migration record in the application SQLite database:

```ts
interface SessionMigrationRecord {
  id: string;
  sourceSessionKey: string;
  sourceAgent: "claude" | "codex" | "codebuddy";
  targetAgent: "claude" | "codex" | "codebuddy";
  targetSessionId: string;
  targetFilePath: string;
  strategy: "complete" | "ai-compressed" | "locally-truncated";
  createdAt: number;
}
```

Repeated migrations are allowed. Existing records let the UI identify previous copies without silently blocking an intentional new migration.

## IPC Contract

Add:

```ts
type MigrationTarget = "claude" | "codex" | "codebuddy";

interface SessionMigrationResult {
  target: MigrationTarget;
  targetSessionId: string;
  targetFilePath: string;
  strategy: "complete" | "ai-compressed" | "locally-truncated";
  resumeCommand: string;
  indexed: boolean;
  launched: boolean;
  warning?: string;
}
```

IPC method:

```ts
migrateSession(sessionKey: string, target: MigrationTarget): Promise<SessionMigrationResult>
```

The main process emits stage updates for:

- `reading`
- `compressing`
- `writing`
- `indexing`
- `launching`

Stage updates include the source session key so the renderer ignores stale updates.

## User Interface

The detail toolbar adds a `Migrate to…` action. The context menu exposes the same action.

Selecting it opens a small target picker:

- Claude Code
- Codex
- CodeBuddy

The source family is disabled. Unsupported and remote sessions show the action disabled with an explanatory tooltip.

During migration, the action toast shows the current stage. On success it reports:

- Target agent
- Migration strategy
- Target session ID

If terminal launch fails, the result dialog provides a copyable resume command.

The UI does not expose compression thresholds or advanced writer settings in the first version.

## Security and Data Boundaries

- Do not copy source system/developer prompts into another agent.
- Do not copy source permission settings or credentials.
- Treat transcript content as untrusted input when generating an AI handoff.
- Do not execute commands found in the transcript.
- Preserve the existing read-only treatment of source session files.
- Only write the newly created target session and the application's migration metadata.

## Testing

### Core Migration

- All six source/target directions.
- Reject same-family migration.
- Reject remote migration.
- Reject unsupported source.
- Reject missing target CLI.
- Preserve project path, message order, roles, and Unicode content.

### Length Handling

- Exact behavior immediately below and above 60,000 estimated tokens.
- AI Provider success.
- Missing Provider.
- Timeout.
- Invalid Provider response.
- Local fallback keeps opening and closing context and marks omissions.

### Writers

- Claude Code output can be read by the Claude loader.
- Codex output can be read by the Codex loader.
- CodeBuddy output can be read by the CodeBuddy loader.
- IDs and parent chains are valid.
- Title metadata is generated.
- Temporary files are cleaned after failure.
- Final installation uses an atomic rename.

### Integration

- IPC request and result types.
- Progress events are routed to the correct session.
- Successful migration refreshes the local index.
- Terminal launch uses the configured target binary and default terminal.
- Launch failure preserves the target session and returns the resume command.

### Renderer

- Detail action and context-menu action are wired.
- Target picker disables the source family.
- Remote sessions show the unsupported explanation.
- Progress and completion messages show the selected strategy.

## Documentation

Update Chinese and English README files with:

- Supported migration matrix
- Local-only limitation
- 60k full-history threshold
- AI compression and local fallback behavior
- Data excluded from migration
- Resume behavior after migration

## Out of Scope

- SSH remote migration
- Migrating tool traces
- Migrating images and attachments
- Preserving model/provider configuration
- Cross-machine migration
- Automatically deleting prior migrated copies
- User-configurable compression threshold
