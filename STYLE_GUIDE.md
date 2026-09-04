# Writing Style Guide

This guide defines how every notebook in this project should read. The goal is that
someone can open a notebook and *learn the topic* from it, the way they would from a
well-written article on GeeksforGeeks or dev.to — not just run cells and see output.

The code is secondary. The explanation is the product.

---

## 1. Voice and tone

- **Explain like a blog post, not a script.** Every concept gets a plain-language
  introduction before any code appears. Assume the reader has never seen the technique.
- **Professional but warm.** Write in full sentences. Use "we" for shared work
  ("we now split the data"), and address the reader directly when giving guidance
  ("you should scale your features before applying PCA").
- **Define the term, then use it.** The first time a concept appears, give a one- or
  two-sentence definition in the reference style shown below.
- **Say *why*, not just *what*.** Do not write "We apply StandardScaler." Write
  "Distance-based models such as K-NN treat every feature as equally important, so a
  feature measured in the tens of thousands will dominate one measured in single
  digits. Standardizing puts them on the same scale."
- **No first-person diary entries.** Avoid "Let's try...", "Now I'll...", "Cool, it
  works!". Keep it instructional.
- **No filler enthusiasm.** Avoid "powerful", "amazing", "simply", "just". State facts.

---

## 2. The reference pattern

Match the rhythm of these examples. Concept sentence → expansion → structured "why"
or "how" list when it helps.

> **Univariate Analysis**
>
> Univariate Analysis is a type of data visualization where we visualize only a single
> variable at a time. Univariate Analysis helps us to analyze the distribution of the
> variable present in the data so that we can perform further analysis.

> **SMOTE**
>
> SMOTE is an oversampling technique that creates synthetic examples of the minority
> class by interpolating between existing examples. Instead of duplicating instances,
> it generates new points that lie between existing ones, making the dataset more
> balanced without overfitting to repeated data.
>
> **Why use SMOTE?**
>
> 1. **Balanced datasets:** SMOTE gives models enough data from all classes, so they
>    do not favor one class over another.
> 2. **Improved model accuracy:** With a balanced dataset, models have a better chance
>    to learn meaningful patterns from the minority class.
> 3. **Effective for small datasets:** When the minority class has very few examples,
>    SMOTE helps without collecting more data.

---

## 3. Notebook structure

Every notebook follows the same skeleton:

1. **Title (H1)** and a 2–4 sentence overview: what this notebook covers and where it
   sits in the syllabus.
2. **Table of contents** as a short bullet list of the sections.
3. **Setup cell** — imports and data loading, with one sentence saying what is loaded.
4. **One section per concept**, each built as:
   - **H2 heading** — the concept name, in plain words.
   - **Explanation (markdown)** — 1–3 short paragraphs in the reference style. This is
     the part that must be able to stand alone as notes.
   - **Code cell** — small, focused, commented only where a line is non-obvious.
   - **Output reading (markdown)** — 1–2 sentences interpreting what the output shows
     *for this dataset*. Never leave a plot or table without a takeaway.
5. **Summary / Key Takeaways** — a bullet list recapping what was learned.

---

## 4. Markdown conventions

- Headings: H1 for the notebook title, H2 for concepts, H3 for sub-parts
  (e.g. "Why use it", "Assumptions", "Limitations").
- **Bold** the term being defined on first use.
- Use numbered lists for steps and ordered reasoning; bullet lists for unordered
  points.
- Use tables for comparisons (e.g. "ID3 vs CART", "Nominal vs Ordinal vs Interval vs
  Ratio").
- Use blockquotes for formal definitions.
- Write math inline with LaTeX (`$R^2 = 1 - \frac{SS_{res}}{SS_{tot}}$`) when a formula
  clarifies the idea. Always follow a formula with a sentence explaining each symbol.
- Keep prose lines readable; wrap around 90–100 characters in markdown cells.

---

## 5. Code conventions

- Code serves the explanation. Keep each cell short and doing one thing.
- Prefer clear variable names over comments. Add a comment only when a line would
  puzzle a learner.
- No dense one-liners that chain five operations. Break them up.
- Print or display intermediate results so the reader sees what each step produced.
- Set a random seed wherever there is randomness, and say so.
- Plots always have a title, axis labels, and a legend when there is more than one
  series.

---

## 6. What to avoid

- Walls of code with no surrounding explanation.
- Explanations that only restate the function name ("`df.describe()` describes the
  dataframe").
- Copy-pasted textbook definitions that do not connect to the dataset.
- Undefined jargon. If you write "heteroscedasticity", define it in the same breath.
- Leaving a result uninterpreted.
- Casual or hype language.

---

## 7. Reference sources for style

When in doubt about how much to explain or how to phrase a definition, match the
depth and structure of a topic article on:

- https://www.geeksforgeeks.org/
- https://dev.to/

These explain a concept from zero, give a worked example, and summarize. That is the
target for every section here.
