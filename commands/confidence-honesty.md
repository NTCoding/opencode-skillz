---
description: "Force honest confidence assessment before claiming conclusions. Triggers on 'root cause identified', 'problem identified', 'complete clarity'. Express confidence as percentage, explain what's stopping 100%, validate assumptions before presenting."
---

# Confidence Honesty

## The Problem

Detailed, well-structured analyses can *look* thorough, then get presented with phrases like "complete clarity" or "root cause identified." Users reasonably trust that confidence. They act on it, communicate it to stakeholders, and make decisions.

Then new evidence appears and invalidates the entire hypothesis.

**The harm:**
- User trusted a conclusion that was actually ~40% confident
- Time wasted on wrong direction
- Stakeholders were misinformed
- Trust in the analysis erodes

**Why this happens:** Explanation quality gets conflated with evidence quality. A thorough, well-reasoned analysis feels like certainty—but reasoning without verified evidence is just speculation with extra steps.

## The Solution

Force explicit confidence assessment before claiming conclusions:
1. Express confidence as a percentage (not vague certainty)
2. Show the math: what evidence adds confidence, what gaps subtract it
3. Mandatory "Why not 100%?" for anything below 95%
4. Self-validate: if more evidence can be gathered directly, do it before presenting

## Critical Rules

🚨 **EXPRESS CONFIDENCE AS A PERCENTAGE.** Every conclusion needs a specific confidence level, not vague certainty.

🚨 **EXPLAIN WHAT'S STOPPING 100%.** For any confidence below 95%, you MUST explain the gaps. Non-negotiable.

🚨 **VALIDATE BEFORE PRESENTING.** If more evidence can be gathered directly, DO IT. Do not present unvalidated hypotheses.

## When This Triggers

Auto-invoke when about to claim:
- "root cause is", "the problem is", "root cause identified"
- "complete clarity", "definitely", "certainly", "clearly the issue"
- Any conclusive claim during investigation

## Confidence Levels

| Range | Icon | Meaning |
|-------|------|---------|
| 0-30% | 🔴 | Speculation - needs significant validation |
| 31-60% | 🟡 | Plausible - evidence exists but gaps remain |
| 61-85% | 🟠 | Likely - strong evidence, minor gaps |
| 86-94% | 🟢 | High confidence - validated, minor uncertainty |
| 95-100% | 💯 | Confirmed - fully validated |

**Calibration:**
- **20%**: One possibility among several
- **40%**: Evidence points this direction but key assumptions unverified
- **60%**: Evidence supports this, alternatives not ruled out
- **80%**: Strong evidence, assumptions verified, alternatives less likely
- **95%**: Validated with direct evidence, alternatives ruled out
- **100%**: Mathematical/logical certainty only

## Pre-Conclusion Checkpoint

**Before claiming ANY conclusion, complete this:**

### 1. Evidence Inventory
- What hard evidence supports this?
- Direct evidence (code/logs that prove it)?
- Circumstantial evidence (patterns consistent)?
- What's the strongest piece of evidence?

### 2. Falsifiability Check
- What would INVALIDATE this theory?
- What data would prove me wrong?
- Has that data been checked?
- If no: WHY NOT?

### 3. Assumption Audit
- What is being assumed WITHOUT verification?
- List each assumption explicitly
- Mark: [VERIFIED] or [ASSUMED]

### 4. Alternative Possibilities
- What else could explain these symptoms?
- List at least 2 alternatives
- Why is my conclusion more likely?

### 5. Validation Opportunities
- Can the actual data be fetched/checked?
- Can the codebase be searched for confirming/denying evidence?
- Should the user be asked for confirming data?

## Confidence Scoring

**Start at 50% (neutral) and adjust:**

| Factor | Adjustment |
|--------|------------|
| Direct evidence (code/logs proving it) | +15-25% |
| Verified assumptions (checked, not assumed) | +10-15% |
| Alternatives ruled out with evidence | +10-15% |
| Falsifiability check completed | +5-10% |
| Unverified critical assumptions | -15-25% |
| Plausible alternatives not ruled out | -10-15% |
| No falsifiability check | -10% |
| Circumstantial evidence only | -10% |

**Example calculation:**
```
Starting: 50%
+ Code analysis shows the pattern: +15%
+ Error logs match signature: +10%
- CRITICAL: Assumed config unchanged (NOT VERIFIED): -25%
- Alternative not ruled out: -10%

Final: 40% 🟡
```

## Response Format

```
[Icon] [X%] Confidence: [One sentence finding]

Evidence:
- [+X%] [Evidence 1]
- [+X%] [Evidence 2]

Why not 100%:
- [-X%] [What's stopping full confidence]

To increase confidence: [What would raise % - can be checked directly or needs user input]
```

## Examples

### 🔴 25% - Low confidence
```
🔴 25% Confidence: Database connection pool may be exhausted

Evidence:
- [+15%] Error pattern matches connection timeout
- [+10%] Load spike occurred around failure time

Why not 100%:
- [-25%] Haven't verified actual pool metrics
- [-15%] Haven't ruled out: network issues, DNS problems
- [-35%] This is mostly pattern matching, not direct evidence

To increase confidence: Connection pool metrics from the time of failure are needed.
```

### 🟠 75% - Moderate-high confidence
```
🟠 75% Confidence: API request failing due to missing required field

Evidence:
- [+20%] Error message explicitly mentions "field required"
- [+15%] Code path analysis shows validation happens here
- [+10%] Field was recently added to validation rules

Why not 100%:
- [-10%] Haven't verified the actual request payload
- [-15%] Could be a different field than suspected

To increase confidence: Check the actual request payload from the failing call.
```

### 💯 98% - Near certain
```
💯 98% Confidence: Root cause is misconfigured environment variable

Evidence:
- [+25%] Environment variable is set to wrong value (verified)
- [+20%] Code directly uses this variable for the failing operation
- [+15%] Error message matches expected failure mode
- [+10%] Fixing the variable in staging resolved the issue

Why not 100%: Haven't deployed fix to production yet to confirm.
```

## Anti-Patterns

### ❌ Premature Certainty

**What happens:**
```
Analysis: "Complete clarity on the root cause"
Assistant: [200 lines of detailed report]
User: [provides data that contradicts analysis]
Assistant: "This changes everything..."
```

**What should happen:**
```
🟡 40% Confidence: The issue appears to be X

Evidence:
- [+15%] Code path analysis suggests this pattern

Why not 100%:
- [-25%] CRITICAL: Haven't verified actual system state
- [-15%] Alternative not ruled out

To increase confidence: Provide [specific data], or check it directly if available.
```

### ❌ Confidence in Explanation Quality

Building a detailed report ≠ having valid evidence.

Thoroughness of presentation has zero correlation with correctness.

**Violation sign:** "Complete clarity" based on reasoning, not evidence.

### ❌ Skipping Falsifiability

If the question "what would prove this wrong?" cannot be answered, the theory is not understood well enough.

## Self-Validation Rule

**Do not return to the user with questions that can be answered directly.**

Before presenting, ask:
```
Can more evidence be gathered directly?
├─ Search codebase for confirming/denying data?
├─ Fetch a file that validates an assumption?
├─ Spawn an agent to investigate further?
└─ Check actual state vs assumed state?

If YES → DO IT. Then reassess confidence.
If NO → Present with honest confidence + what is needed from the user.
```

**Critical:** If confidence is below 80% and more evidence can be gathered directly → DO IT.

## Summary

🚨 **Confidence is a percentage, not a feeling.**

🚨 **Below 95%? Explain what's stopping 100%.**

🚨 **Can validate yourself? Do it before presenting.**

The goal: Never claim "complete clarity" with 40% confidence and unverified assumptions.
