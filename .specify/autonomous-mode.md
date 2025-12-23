# Autonomous Work Protocol for AI Assistants

**Version**: 1.0.0  
**Context**: Solo Developer Mode  
**Last Updated**: 2025-12-22

## Autonomy Levels

### FULL AUTONOMY (Default for Solo Mode)

When user says **"Autonomy: full"** or this file exists, AI assistants MUST:

✅ **PROCEED WITHOUT ASKING** for:

- Writing code files
- Creating/modifying tests
- Running local commands (`npm test`, `go test`, etc.)
- Creating local documentation files
- Refactoring code
- Fixing bugs
- Implementing specified features
- Creating/updating markdown files in `.specify/`
- Git commits with clear messages
- Installing dependencies
- Running build tools locally

❌ **NEVER DO** (even in full autonomy):

- Create GitHub PRs, issues, or workflows
- Push to remote without explicit instruction
- Delete files without mentioning it
- Escalate to external services (GitHub Support, etc.)
- Make breaking API changes without warning
- Modify CI/CD configurations
- Change project dependencies in breaking ways

⚠️ **INFORM BUT PROCEED** (do it, then tell user):

- "I've created X file with Y functionality"
- "Tests added and passing locally"
- "Fixed issue Z in file A"
- NOT "Should I create X?" or "Would you like me to...?"

### Communication Style in Full Autonomy

**BAD** (too many questions):

```
Should I create the test file?
Would you like me to run the tests?
Do you want me to add error handling?
Can I proceed with implementation?
```

**GOOD** (action-first):

```
Created user_service_test.go with 3 test cases.
Running tests... ✓ All passing.
Added error handling for nil pointer case.
Implementation complete - ready for your review.
```

### When to Ask (Even in Full Autonomy)

ONLY ask when:

1. **Ambiguous requirements**: "Should the API return JSON or XML?" (technical decision needed)
2. **Multiple valid approaches**: "Two options for caching: Redis or in-memory. Which fits your setup?"
3. **Discovered issues**: "Found security vulnerability in dependency X. Update to Y (breaking) or keep current?"
4. **User preference needed**: "Error messages in English only, or add i18n now?"

### How to Handle Blockers

If blocked, MAKE A DECISION and proceed:

**BAD**:

```
I need to know X before I can continue.
What should I do about Y?
[waits for response]
```

**GOOD**:

```
Assuming X based on common practice for [reason].
Implementing Y with default configuration - you can adjust in config.yaml.
[proceeds with reasonable defaults]
```

## Constitution Compliance in Autonomous Mode

### Code Quality

- ✅ Auto-format code
- ✅ Fix linting issues
- ✅ Add comments for complex logic
- No asking needed

### Testing

- ✅ Write tests for new code
- ✅ Run tests locally
- ✅ Report results
- No asking needed unless tests fail unexpectedly

### User Experience

- ✅ Use consistent patterns from existing code
- ✅ Add error messages
- ⚠️ ASK for user-facing text if branding/tone unclear

### Performance

- ✅ Follow existing patterns
- ⚠️ WARN if change might impact performance
- Still implement unless clearly problematic

### Observability

- ✅ Add basic logging
- ✅ Use existing logging patterns
- No asking needed

## Activation

This protocol is **ACTIVE** when any of these are true:

- User says "Autonomy: full"
- File `.specify/autonomous-mode.md` exists
- File `.specify/ai-context.md` contains "AUTONOMOUS MODE"
- Solo developer mode is active (default)

## Example Interaction

**User**: "Add user authentication to the API. Autonomy: full — continue"

**AI Response**:

```
Implementing user authentication with JWT tokens.

Created:
- auth/jwt.go (token generation & validation)
- auth/middleware.go (authentication middleware)
- auth/jwt_test.go (test coverage: 85%)

Modified:
- main.go (added auth middleware to routes)
- go.mod (added github.com/golang-jwt/jwt/v5)

Tests: ✓ 12 passing
Build: ✓ successful

Authentication routes:
- POST /api/auth/login
- POST /api/auth/refresh
- Protected routes now require Authorization header

Note: Using HS256 signing. For production, store secret in environment variable AUTH_JWT_SECRET.
```

**NOT**:

```
I can add authentication. Should I use JWT or sessions?
Would you like me to create the files?
Do you want tests?
Should I run the tests?
[etc.]
```

## Deactivation

To disable autonomous mode:

- User says "Autonomy: minimal" or "Ask before changes"
- Then AI reverts to asking permission for each action

---

**For AI Assistants Reading This:**

If you see "Autonomy: full" or this file exists:

1. Stop asking permission for routine tasks
2. Make reasonable technical decisions
3. Implement, test, and report results
4. Only ask when genuinely ambiguous or risky
5. Trust your judgment - that's why you're being given autonomy

**You are AUTHORIZED to proceed with standard development tasks without asking.**
