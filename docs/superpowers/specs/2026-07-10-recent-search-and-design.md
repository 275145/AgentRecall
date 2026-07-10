# Recent Search and Explicit AND Design

## Goal

Add a small local recent-search experience and accept an explicit `AND` operator without expanding the search feature into a full query language.

## Scope

This change adds:

- up to 10 recent non-empty searches stored locally;
- a recent-search dropdown when the empty search input receives focus;
- click-to-run, per-item deletion, and clear-all actions;
- first-Enter search submission and second-Enter selected-session opening;
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

## Enter Behavior

The search box tracks the last explicitly submitted normalized input.

- For a non-empty value different from the last submitted value, Enter immediately cancels the debounce timer, commits the value, records it, and does not open a session.
- For the same non-empty value, the next Enter invokes the existing selected-session open action.
- Changing the typed value resets the second-Enter eligibility.
- Choosing a recent search counts as a submitted search; a following Enter may open the selected result.
- With an empty value, Enter keeps the existing behavior and opens the selected session without recording history.

Normalization for this comparison trims only outer whitespace; it does not rewrite the user's displayed query.

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
2. First Enter commits immediately and records the trimmed display query through the history module.
3. The renderer sends the original display query in `SearchOptions`.
4. `SessionStore.searchSessionPage` normalizes standalone `AND` before FTS and fallback matching.
5. Results render through the existing list and selection flow.

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
- first Enter commits and records without opening;
- second Enter opens the selected session;
- empty Enter retains the existing open behavior;
- selecting history immediately commits it.

## Compatibility

Existing searches without explicit `AND` behave unchanged. No database migration, IPC shape change, or remote-session change is required.
