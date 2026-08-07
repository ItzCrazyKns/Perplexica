# Write operations are confirmed as a single batch

All write and create operations within one response are grouped into one confirmation card the user approves or rejects as a batch — never one prompt per operation. This introduces an interactive, awaitable block into Vane's otherwise one-way streaming response pipeline. Balances safety (writes are hard to undo) against interruption fatigue.
