# Security Specification for DIA SCHREIBEN

## Data Invariants
1. A user can only read and write their own profile document.
2. A user can only read and write their own exercises.
3. A user can only read and write their own progress/evaluations.
4. Timestamps (`createdAt`, `updatedAt`) must be set by the server.
5. `uid` and `email` in User documents must match the authenticated user's credentials.

## The Dirty Dozen Payloads (Negative Tests)
1. **Identity Spoofing**: Attempt to write a User document with a different `uid`.
2. **Access Violation**: User A attempts to read User B's exercises.
3. **Cross-User Injection**: User A attempts to add an exercise to User B's collection.
4. **Progress Hijacking**: User A attempts to update User B's progress.
5. **Timestamp Forge**: Attempt to set `createdAt` manually instead of using `request.time`.
6. **Immutable ID Breach**: Attempt to change the `exerciseId` of a progress document during update.
7. **Size Poisoning**: Attempt to upload an extremely large string (e.g., > 1MB) as the exercise situation.
8. **Malicious ID Injection**: Attempt to use a document ID containing path traversal characters (e.g., `../../../evil`).
9. **Role Escalation**: Attempt to set an `isAdmin` field in a User document (even though not defined in schema, rules should block shadow fields).
10. **Type Mismatch**: Attempt to set `score` as a string instead of a number in `Progress`.
11. **Negative Score**: Attempt to set a `score` less than 0 or greater than 100.
12. **Orphan Progress**: Attempt to create progress for an exercise ID that doesn't exist.

## Verification
These rules will be verified with Firestore Security Rules tests.
