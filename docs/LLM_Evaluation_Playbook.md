# LLM Evaluation Playbook

A practical guide for building reliable, cost-effective evaluation systems using LLMs. The core principle: **LLMs judge, code computes.**

---

## 1. The Split: What the LLM Does vs What Code Does

The single most impactful decision in an LLM evaluation pipeline is drawing a clean line between subjective judgment and deterministic computation.

### LLM is responsible for:
- **Assigning granular sub-scores** against defined rubric criteria
- **Writing evidence-based comments** that reference specific inputs
- **Classifying and interpreting** ambiguous or nuanced content
- **Cross-referencing** multiple inputs against each other (e.g., "does the screenshot match what the candidate claimed?")

### Code is responsible for:
- **Aggregating sub-scores** into section totals (sum, average, weighted)
- **Computing overall scores** from section totals using weights
- **Clamping and rounding** values to valid ranges
- **Redistributing weights** when sections have no input data
- **Validating structure** — required fields, types, bounds

### Why this split matters:
- LLMs are unreliable at arithmetic. A model will confidently return sub-scores that don't add up to the section total it also returns. If you ask for both, you get contradictions.
- Every token spent on calculation instructions is a token not spent on evaluation quality.
- Programmatic computation is deterministic. The same sub-scores always produce the same total. No variance, no drift across runs.

---

## 2. Designing the Schema

### Keep the LLM schema minimal

Only ask the LLM to return fields that require judgment. Everything derivable should be absent from the schema and added by code after the response.

**Bad — asking the LLM to compute totals:**
```json
{
  "section": {
    "subScoreA": 1.5,
    "subScoreB": 2.0,
    "sectionTotal": 3.5,
    "weightedContribution": 1.05
  },
  "overallScore": 7.2
}
```

**Good — LLM returns only judgments:**
```json
{
  "section": {
    "subScores": {
      "criterionA": 1.5,
      "criterionB": 2.0
    },
    "comments": "..."
  }
}
```

Code then adds `sectionTotal`, `overallScore`, and any derived fields.

### Use strict schema enforcement

If your API supports it (e.g., OpenAI's `json_schema` with `strict: true`), define the exact schema and let the API guarantee conformance. This eliminates:
- Malformed JSON
- Missing fields
- Extra fields the model decided to add
- Type mismatches (string where you expected number)

```javascript
text: {
  format: {
    type: "json_schema",
    name: "EvaluationResult",
    strict: true,
    schema: evaluationSchema,
  },
}
```

If strict schemas aren't available, validate the response server-side and retry (with a cap) on structural failures.

### Define sub-score ranges in both the schema and the prompt

The prompt should describe what each value means (e.g., "0 = no evidence, 1 = partial, 2 = strong"). The code should clamp values to the valid range after receiving the response. Belt and suspenders.

---

## 3. Prompt Design for Evaluation

### Tell the model what NOT to do

Explicitly state that scores are computed programmatically and the model should not attempt to calculate totals:

> "Do NOT include score totals or an overall score — these are computed from your sub-scores. Focus only on assigning sub-scores and writing evidence-based comments."

This saves tokens, reduces confusion, and prevents the model from trying to "make the math work" by adjusting sub-scores to hit a target total it has in mind.

### Structure the rubric as a checklist, not a narrative

**Bad:**
> "Evaluate the quality of the output considering completeness, accuracy, and presentation."

**Good:**
> "Rate each criterion 0-2:
> - **Completeness** (0-2): Does the output address all requirements?
> - **Accuracy** (0-2): Are solutions correct and error-free?
> - **Presentation** (0-2): Is the output clear and well-organized?"

The checklist format maps directly to the schema fields, reducing the chance of the model inventing its own structure.

### Separate evidence from scoring

Ask for `comments` as a distinct field, not interleaved with scores. This keeps the structured data clean and the qualitative feedback readable. The comments field is where the model should cite specific evidence from the inputs.



## 4. Post-Processing Pipeline

After receiving the LLM response, run a deterministic audit before returning results.

### Step 1: Clamp sub-scores
```javascript
for (const key of Object.keys(section.subScores)) {
  section.subScores[key] = clamp(round(value, 1), 0, maxPerCriterion);
}
```

### Step 2: Compute section totals
```javascript
section.score = sum(Object.values(section.subScores));
```

### Step 3: Handle missing sections
If a section has all-zero sub-scores and minimal comments, set its weight to 0 and redistribute proportionally:
```javascript
const hasData = section.score > 0 || section.comments.length > threshold;
const effectiveWeight = hasData ? defaultWeight : 0;
// Normalize remaining weights to sum to 1
```

### Step 4: Compute overall score
```javascript
overallScore = sections.reduce(
  (sum, s) => sum + s.score * s.normalizedWeight, 0
);
```

### Step 5: Attach computed fields
Add `score`, `overallScore`, and any derived metadata to the response object before storing or returning it.

---

## 5. Cost and Context Optimization

### Don't send instructions for work the model won't do

Every line of "calculate the weighted score using these formulas" is wasted context if you're computing it in code. Remove it. The prompt should describe what to evaluate and how to judge — not how to do arithmetic.

### Use the cheapest model that handles your judgment complexity

- **Sub-score assignment against a clear rubric** — a smaller/cheaper model often suffices
- **Nuanced interpretation of ambiguous content** — needs a stronger model
- **Arithmetic and validation** — needs no model at all

### Don't duplicate the schema in the prompt

If you're using strict schema enforcement, the model already knows the output structure. A brief reference ("Rate each criterion 0-2 and provide comments") is enough. You don't need to repeat the full JSON shape in the prompt body — the schema constraint handles it. Keep a minimal example if it aids clarity, but drop the verbose field-by-field specification.

### Batch independent evaluations

If you're evaluating multiple dimensions that don't depend on each other, consider whether a single call with all dimensions is cheaper than multiple targeted calls. Usually one call is cheaper (avoids repeated context), but if inputs are large and only some dimensions need them (e.g., only the output section needs file contents), splitting can reduce total tokens.

