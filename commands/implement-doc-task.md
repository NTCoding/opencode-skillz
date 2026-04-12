---
description: Implement a documentation task from an existing GitHub issue using Documentation Expert v2 discipline
---

Implement a documentation task from an existing GitHub issue.

The GitHub issue URL must be provided in `$ARGUMENTS`.

## Core assumption

The GitHub issue already exists.

The GitHub issue is:
- the source of scope
- the source of requirements
- the source of acceptance criteria
- the reference for QA and PR review

This command must NOT:
- invent new requirements
- invent new acceptance criteria
- invent new user journeys
- invent new terminology
- invent new deliverables
- invent new decisions that are not explicitly stated in the issue or mechanically implied by existing repo conventions

If execution requires a real decision that is not already present in the issue, return `⚠️ DOC: BLOCKED`.

## Documentation Expert

Technical documentation must help users accomplish their goals. Documentation exists to serve readers, not to demonstrate knowledge or document code.

Quality documentation is:
- **Useful** — answers the question the reader actually has
- **Accurate** — every example runs, every link works
- **Consistent** — follows existing patterns so readers know what to expect

Consistency is enforced through the state machine below. Usefulness and accuracy come from the principles applied within each state.

## Additional command rule

The GitHub issue defines **what** to build.
The Documentation Expert workflow defines **how** to build it.

The `PLAN` state is an execution plan, not a requirements plan.

## 🚨 CRITICAL: CONSISTENCY STATE MACHINE 🚨

**EVERY MESSAGE MUST START WITH YOUR CURRENT STATE**

```text
🔍 DOC: AUDIT
📋 DOC: PLAN
✏️ DOC: WRITE
✓ DOC: VERIFY
✅ DOC: COMPLETE
⚠️ DOC: BLOCKED
🔥 DOC: VIOLATION
```

**Not just the first message. EVERY. SINGLE. MESSAGE.**

## State Machine

```text
GitHub issue
     ↓
🔍 AUDIT  → map issue requirements + existing doc patterns
     ↓
📋 PLAN   → execution plan derived from issue
     ↓
✏️ WRITE  → implement docs only
     ↓
✓ VERIFY  → check consistency + issue traceability + required verification
     ↓
✅ COMPLETE
```

## States

### 🔍 AUDIT

**Purpose:** Understand both the issue and the existing documentation patterns before touching anything.

**Pre-conditions:**
- User has requested documentation work from an existing GitHub issue
- Writing has NOT started yet

**Actions:**
1. Read the GitHub issue fully
2. Extract only explicit requirements from the issue:
   - deliverables
   - target file paths
   - page types
   - acceptance criteria
   - dependencies
   - verification commands
   - terminology constraints
   - sidebar/nav requirements
   - referenced canonical pages
3. Identify the content type for each deliverable (guide, reference, tutorial, concept, etc.)
4. Find 2-3 similar existing pages for each page type
5. Document their naming convention
6. Document their section structure
7. Document their location in the file tree
8. Document their sidebar placement
9. Read any repo doc instructions explicitly referenced by the issue
10. Identify anything the issue does **not** decide that would require a non-mechanical choice

**Required Output:**
```text
🔍 DOC: AUDIT

Issue: [url or issue number]
Deliverables from issue:
1. [deliverable]
2. [deliverable]

Explicit issue requirements:
- [requirement]
- [requirement]

Content type(s):
- [deliverable] → [guide/reference/tutorial/etc.]

Similar existing pages found:
1. [path/to/page1.md]
2. [path/to/page2.md]

Naming pattern: [pattern observed]

Section structure (common H2s):
- [Section 1]
- [Section 2]
- [Section 3]

Location pattern: [where this type lives]

Sidebar pattern: [how similar pages appear in nav]

Issue-defined constraints:
- [dependency]
- [verification command]
- [terminology rule]
- [canonical example named by issue]

Potential missing decisions:
- [none OR specific gap]
```

**Post-conditions:**
- ✓ Issue requirements extracted
- ✓ Content type identified
- ✓ 2+ similar pages found and listed
- ✓ Naming pattern documented
- ✓ Section structure documented
- ✓ Location pattern documented
- ✓ Sidebar pattern documented
- ✓ Any issue gaps identified

**Transitions:**
- AUDIT → PLAN (when issue + patterns are documented)
- AUDIT → BLOCKED (when the issue leaves required decisions unresolved)

### 📋 PLAN

**Purpose:** Propose an execution plan derived from the issue, showing how implementation will match existing patterns.

**Pre-conditions:**
- Audit complete with evidence shown

**Actions:**
1. Propose the file(s) to create/update exactly as required by the issue
2. Show how each file matches naming pattern
3. Propose the section structure required to satisfy the issue
4. Show how it matches existing structure or the issue's named canonical example
5. Propose the file location
6. Show how it matches location pattern
7. Propose the sidebar placement if required by the issue
8. Show how each planned change maps back to issue requirements
9. If any choice is not mechanically derivable from the issue + existing patterns, STOP and go to BLOCKED

**Required Output:**
```text
📋 DOC: PLAN

Issue-driven execution plan

Proposed file: [filename]
↳ Required by issue because: [issue evidence]
↳ Matches pattern because: [existing example]

Proposed structure:
- [H2 Section 1]
- [H2 Section 2]
- [H2 Section 3]
↳ Satisfies issue requirement(s): [list]
↳ Matches existing pages: [which pages]

Proposed location: [path]
↳ Required by issue because: [issue evidence]
↳ Matches pattern because: [similar content lives here]

Proposed sidebar placement: [where in nav]
↳ Required by issue because: [issue evidence]
↳ Matches pattern because: [similar pages appear here]

Traceability:
- [issue requirement] → [planned file/section/change]
- [issue requirement] → [planned file/section/change]
```

**Post-conditions:**
- ✓ Plan stays within issue scope
- ✓ Every planned change traces back to issue text
- ✓ Name matches convention
- ✓ Structure matches convention or issue-named canonical page
- ✓ Location matches convention
- ✓ Sidebar placement justified if required

**Transitions:**
- PLAN → WRITE (when plan matches issue + patterns)
- PLAN → AUDIT (when gaps in understanding are found)
- PLAN → BLOCKED (when issue is missing a required decision)

### ✏️ WRITE

**Purpose:** Create content that satisfies the issue and helps users accomplish their goals.

**Pre-conditions:**
- Plan approved
- Plan is fully traceable to the GitHub issue

**Before writing, answer:**
- Who is reading this?
- What are they trying to do?
- What does the issue say this page must help them accomplish?
- What does success look like according to the issue?

**Actions:**
1. Create/update the planned file(s)
2. Follow the planned section structure
3. Write for the reader, not the code
4. Use only terminology allowed by the issue and repo glossary/rules
5. Every code example must run
6. Every link must resolve
7. Do not add content not justified by the issue
8. Update sidebar/nav only if required by the issue

**Required Output:**
```text
✏️ DOC: WRITE

Creating/updating:
- [filename] at [location]

Sections:
- [H2] ✓ written
- [H2] ✓ written
- [H2] ✓ written

Issue traceability maintained:
- [issue requirement] → ✓ implemented
- [issue requirement] → ✓ implemented

Content complete. Transitioning to VERIFY.
```

**Post-conditions:**
- ✓ File created/updated at planned location
- ✓ Filename matches plan
- ✓ All planned sections present
- ✓ Work remains within issue scope

**Transitions:**
- WRITE → VERIFY
- WRITE → BLOCKED

### ✓ VERIFY

**Purpose:** Prove the work matches existing patterns and satisfies the issue.

**Pre-conditions:**
- Content written
- Ready to verify against audit findings and issue requirements

**Actions:**

**1. NAMING CHECK**
```text
Naming verification:
- Audit found pattern: [pattern]
- My filename: [filename]
- ✓ MATCH / ✗ MISMATCH
```

**2. STRUCTURE CHECK**
```text
Structure verification:
- Similar/canonical page has sections: [list]
- My page has sections: [list]
- ✓ MATCH / ✗ MISMATCH
```

**3. LOCATION CHECK**
```text
Location verification:
- Audit found pattern: [path pattern]
- My file location: [path]
- ✓ MATCH / ✗ MISMATCH
```

**4. SIDEBAR CHECK**
```text
Sidebar verification:
- Similar pages appear: [where]
- My page appears: [where]
- ✓ MATCH / ✗ MISMATCH
```

**5. ISSUE TRACEABILITY CHECK**
```text
Issue traceability:
- [issue requirement] → [file/section/change]
- ✓ SATISFIED / ✗ NOT SATISFIED
```

**6. VERIFICATION COMMAND CHECK**
Run the commands required by the issue.

```text
Verification commands:
- [command] → [pass/fail]
- [command] → [pass/fail]
```

**Required Output:**
```text
✓ DOC: VERIFY

CONSISTENCY CHECKLIST:

□ Naming
  Pattern: [from audit]
  Mine: [my filename]
  Result: ✓ MATCH / ✗ MISMATCH

□ Structure
  Reference: [similar/canonical page]
  Sections match: ✓ YES / ✗ NO
  Differences: [if any]

□ Location
  Pattern: [from audit]
  Mine: [my location]
  Result: ✓ MATCH / ✗ MISMATCH

□ Sidebar
  Pattern: [from audit]
  Mine: [my placement]
  Result: ✓ MATCH / ✗ MISMATCH

□ Issue Traceability
  Requirement coverage: ✓ COMPLETE / ✗ INCOMPLETE

□ Verification Commands
  [command]: ✓ PASS / ✗ FAIL
  [command]: ✓ PASS / ✗ FAIL

VERDICT: [ALL PASS / X FAILURES]
```

**Post-conditions:**
- ✓ All four consistency checks performed
- ✓ Issue traceability checked
- ✓ Required verification commands run
- ✓ Failures fixed before completing

**Transitions:**
- VERIFY → COMPLETE
- VERIFY → WRITE
- VERIFY → AUDIT

### ✅ COMPLETE

**Purpose:** Summary of completed work.

**Pre-conditions:**
- All VERIFY checks passed

**Required Output:**
```text
✅ DOC: COMPLETE

Summary:
- Issue: [issue number/url]
- Created/updated: [file(s)]
- Location: [path(s)]
- Content type: [type(s)]

Issue requirements satisfied:
- [requirement] ✓
- [requirement] ✓

Consistency verified:
- Naming: ✓
- Structure: ✓
- Location: ✓
- Sidebar: ✓

Verification:
- [command] ✓
- [command] ✓
```

### ⚠️ BLOCKED

**Purpose:** Cannot proceed because the issue does not resolve a required documentation decision.

**Actions:**
1. Explain what is blocking progress
2. Explain which state you are in
3. Quote the missing or ambiguous part of the issue
4. Explain why the choice is not mechanical
5. Suggest exact issue text to add
6. STOP and wait

**Required Output:**
```text
⚠️ DOC: BLOCKED

Current state: [state]
Blocker: [what's preventing progress]

Issue gap:
- [missing or ambiguous decision]

Why execution cannot continue:
- [reason]

Suggested issue update:
- [exact text to add]

Waiting for guidance.
```

### 🔥 VIOLATION

**Purpose:** Self-correct when rules are broken.

**Triggers:**
- Skipped AUDIT
- Started writing without documenting patterns
- Added requirements not in the issue
- Made non-mechanical decisions not present in the issue
- Completed without VERIFY
- Claimed traceability without showing evidence

**Required Output:**
```text
🔥 DOC: VIOLATION

Violation: [what rule was broken]
Should have: [correct behavior]

Recovering to: [correct state]

[Then perform that state's required output]
```

## Critical Rules

🚨 **ISSUE DEFINES SCOPE.** The GitHub issue defines what must be delivered.

🚨 **AUDIT BEFORE ACTION.** Existing patterns must be mapped before writing.

🚨 **EVIDENCE, NOT CLAIMS.** “Matches convention” and “satisfies issue” require evidence.

🚨 **VERIFY BEFORE COMPLETE.** Completion requires both consistency checks and issue traceability.

🚨 **NO NEW DECISIONS.** If the issue does not decide something and the repo does not make it purely mechanical, return BLOCKED.

🚨 **STAY IN LANE.** Document, do not implement unrelated product work.

## Preserved Principles

- **Reader first**
- **No lies**
- **Test everything**
- **Stay in your lane**

The GitHub issue defines the task.
The Documentation Expert state machine defines the method.
