# Recent Search and Explicit AND Design

## Goal

Add a small local recent-search experience and accept an explicit `AND` operator without expanding the search feature into a full query language.

## Scope

This change adds:

- up to 10 recent non-empty searches stored locally;
- a recent-search dropdown when the empty search input receives focus;
- click-to-run, per-item deletion, and clear-all actions;
- recording a non-empty query when it actually leads to opening a search result;
- case-insensitive standalone `AND` as an alias for the existing implicit AND behavior.

It does not add quoted phrases, exclusion operators, role search, cloud synchronization, or a general query parser.

## Search History Model

Create a focused renderer module at `src/renderer/src/search-history.ts` with pure helpers for reading, recording, deleting, and clearing recent searches.

Use a version-independent JSON string array under the localStorage key:

```text
agent-session-search-recent-searches
```

Rules:

- trim leading and trailing whitespace before recording;
- ignore empty values;
- deduplicate exact trimmed strings;
- move a repeated search to the front;
- keep the 10 most recent entries;
- treat malformed, non-array, or non-string stored values as an empty history;
- never upload or write history to SQLite.

History matching remains case-sensitive for display fidelity: `Codex` and `codex` may coexist because the user typed distinct searches.

## Search Box Interaction

`SearchBox` continues to own its typed value so keystrokes do not rerender the full application.

When the input is focused and its value is empty, show a dropdown containing recent searches. Each item provides:

- a main button that fills the input and immediately commits the selected search;
- a delete button that removes only that item without running it.

A `Clear recent searches / 清空最近搜索` action removes all entries. The dropdown closes when the input loses focus, Escape is pressed, a history item is chosen, or the user begins typing a non-empty value. Pointer interactions inside the dropdown must complete before blur closes it.

No dropdown is shown when history is empty.

## Open and Record Behavior

Search remains live and has no separate submission state.

- Enter always keeps the existing behavior and opens the selected session immediately.
- Double-clicking a result or using the existing keyboard open action behaves the same way.
- When a result is actually opened from the main search list and the current query is non-empty, record the trimmed query.
- Opening a session from unrelated surfaces such as the AI assistant does not record the main search query.
- Choosing a recent search only fills and commits the query so live results refresh; it does not reorder or record the history until a result is opened.
- Empty searches are never recorded.

## Explicit AND Semantics

The core search module normalizes standalone case-insensitive `AND` tokens to whitespace before building the FTS query and performing fallback text matching.

These are equivalent:

```text
login expired
login AND expired
login and expired
```

Existing FTS token joining already supplies implicit AND semantics, so no new SQL operator construction is needed. Only standalone tokens are removed. Substrings such as `android`, `candy`, and `R&D` remain normal search text.

A query containing only `AND` normalizes to an empty query and behaves like an empty search rather than raising an FTS error.

## Data Flow

1. Typing updates local SearchBox state and retains the existing debounce.
2. The renderer sends the original display query in `SearchOptions`.
3. `SessionStore.searchSessionPage` normalizes standalone `AND` before FTS and fallback matching.
4. Results render through the existing list and selection flow.
5. Opening a main-list result records the trimmed query locally.

## Error Handling

- localStorage read, parse, or write failures do not block searching; history falls back to memory for the current SearchBox lifetime.
- Invalid stored history is discarded logically without throwing.
- Removing or clearing history is idempotent.
- Explicit `AND` normalization cannot generate raw FTS syntax and therefore does not expose SQLite query syntax.

## Testing

### Search history unit tests

- malformed storage becomes an empty list;
- empty strings are ignored;
- repeated searches move to the front;
- only 10 entries are retained;
- deleting one entry and clearing all entries persist correctly;
- storage write failures do not throw.

### Search store tests

- explicit uppercase and lowercase `AND` equal implicit AND;
- sessions missing either term are excluded;
- `android` and other embedded substrings are preserved;
- an AND-only query is handled as empty search.

### Renderer contract tests

- the dropdown renders history items, deletion, and clear-all controls;
- Enter retains the existing immediate-open behavior;
- opening a main-list result records a non-empty query;
- opening an unrelated session does not record the current query;
- selecting history immediately fills and commits the search without recording it.

## Compatibility

Existing searches without explicit `AND` behave unchanged. No database migration, IPC shape change, or remote-session change is required.
