# Security Specification: School Thematic Quiz Sessions

## 1. Data Invariants
- Each document in `/sessions/{sessionId}` must have an `id` that strictly equals `sessionId`.
- Each session document must contain: `id`, `title`, `createdAt`, `updatedAt`, `ownerId`, `questions`.
- `title` is non-empty string <= 300 characters.
- `questions` is an array of <= 200 questions.
- Write operations (create, update, delete) and read operations are permitted for teachers. Anyone accessing the school app can read synchronized school sessions to ensure presentation screens immediately sync across all computers in school.
- Modifying or deleting a session requires matching `ownerId == request.auth.uid` or `ownerId == incoming().ownerId`.

## 2. The "Dirty Dozen" Payloads
1. Create session without `id` -> REJECT
2. Create session where `id != sessionId` -> REJECT
3. Create session with title > 300 chars -> REJECT
4. Create session with negative or non-numeric `createdAt` -> REJECT
5. Create session with > 200 questions -> REJECT
6. Create session with arbitrary system collection paths -> REJECT
7. Update session changing `id` -> REJECT
8. Update session with non-string `title` -> REJECT
9. Write session with missing `questions` field -> REJECT
10. Attempting write to undeclared collections -> REJECT
11. Large payload exceeding document constraints -> REJECT
12. Attempting to bypass schema verification -> REJECT
