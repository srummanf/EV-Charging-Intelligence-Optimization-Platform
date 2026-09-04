# Code Style Guide

`STYLE_GUIDE.md` covers the *prose*. This file covers the *code*: how cells are broken
up, which snippets to reuse, and the fixed section order for each kind of notebook.

Two templates:

- **EDA notebooks** (`01_EDA/`) → follow the *EDA template* below.
- **ML notebooks** (`02_` onward) → follow the *ML template* below.

General rules for both:

- **One idea per cell.** A cell either does a single operation or draws a single plot.
  Never chain five steps in one cell.
- **Show the result.** End a cell with the bare object (`df`, `cm`, `acc`) or a
  `print()` so the output is visible. Do not compute silently.
- **Comment the intent, lightly.** A short `# what this does` comment above a cell is
  fine. Do not narrate every line — the markdown cell above already explained it.
- **Verify with `assert`.** After any preprocessing step, add a cell that asserts the
  step worked.
- **Seed randomness.** Pass `random_state=` everywhere it is accepted, and mention the
  seed in the markdown.

---

## EDA template

Fixed section order. Keep the headings exactly as written.

### 1. Loading Data

```python
# Load DataFrame
file = 'file.csv'
df = pd.read_csv(file)
```

### 2. Basic Data Exploration

```python
# Show rows and columns count
print(f"Rows count: {df.shape[0]}\nColumns count: {df.shape[1]}")
```

```python
df.head()
```

```python
df.tail()
```

#### Check Data Types

```python
# Show data types
df.info()
```

Then a short markdown list reading the output:

> * `column1`, `column2`, `column3` are strings.
> * `column4` and `column5` are floats.
> * `column6` is an integer.
>
> `column3` should be a datetime type instead.

#### Check Missing Data

```python
# Print percentage of missing values
missing_percent = df.isna().mean().sort_values(ascending=False)
print('---- Percentage of Missing Values (%) -----')
if missing_percent.sum():
    print(missing_percent[missing_percent > 0] * 100)
else:
    print('None')
```

#### Check for Duplicate Rows

```python
# Show number of duplicated rows
print(f"No. of entirely duplicated rows: {df.duplicated().sum()}")

# Show duplicated rows
df[df.duplicated()]
```

#### Check Uniqueness of Data

```python
# Print the percentage similarity of values (the lower %, the better)
num_unique = df.nunique().sort_values()
print('---- Percentage Similarity of Values (%) -----')
print(100 / num_unique)
```

#### Check Data Range

```python
# Print summary statistics
df.describe(include='all')
```

### 3. Areas to Fix

A markdown cell only. List concrete issues found above, grouped:

> **Data Types**
> * Issue 1
>
> **Missing Data**
> *
>
> **Duplicate Rows**
> *
>
> **Uniqueness of Data**
> *
>
> **Data Range**
> *

### 4. Data Preprocessing

Add only the sub-sections the dataset actually needs. Each fix is followed by an
`assert` cell.

#### Rename Columns

```python
# Rename columns
columns_to_rename = {}
df.rename(columns=columns_to_rename, inplace=True)
```

```python
# Verify columns are renamed
df.columns
```

#### Drop Redundant Columns

```python
# Check the proportion of the most frequent value in each column
print('---- Frequency of the Mode (%) -----')
mode_dict = {col: (df[col].value_counts().iat[0] / df[col].size * 100) for col in df.columns}
mode_series = pd.Series(mode_dict)
mode_series
```

```python
# Show the value frequency of each column above the mode threshold
threshold = 80
for col in mode_series[mode_series > threshold].index:
    print(df[col].value_counts(dropna=False))
    print()
```

```python
# Drop columns
cols_to_drop = []
df.drop(columns=cols_to_drop, axis=1, inplace=True)
```

```python
# Verify columns dropped
assert all(col not in df.columns for col in cols_to_drop)
```

#### Changing Data Types

```python
# Convert columns to the right data types
df[col] = df[col].astype('string')
df[col] = df[col].astype('int')
df[col] = pd.to_datetime(df[col])

# Ordered categorical
col_cat = pd.CategoricalDtype(categories=['A', 'B', 'C'], ordered=True)
df['col_cat'] = df['col_cat'].astype(col_cat)
```

```python
# Verify conversion
import pandas.api.types as ptypes
assert ptypes.is_string_dtype(df[col])
assert ptypes.is_numeric_dtype(df[col])
```

#### Dropping Duplicates

```python
df.drop_duplicates(inplace=True, ignore_index=True)
```

```python
assert df.duplicated().sum() == 0
```

#### Handling Missing Values

Explain the method chosen in markdown first, then apply it, then assert no nulls
remain (or that the count dropped as expected).

#### Handling Unreasonable Data Ranges

```python
# Drop affected rows
df = df.loc[~((df['A'] == 0) | (df['B'] > 100))].reset_index(drop=True)
```

```python
# Verify rows dropped
len(df)
```

#### Feature Engineering / Transformation

```python
# Get unique values across several columns
cols = []
pd.unique(df[cols].values.ravel('k'))
```

```python
def custom_function(param1: int, param2: str) -> bool:
    """Example function with Google-style docstring.

    Args:
        param1: The first parameter.
        param2: The second parameter.

    Returns:
        True for success, False otherwise.
    """
```

### 5. Data Analysis

One sub-section per variable or question. Each is: **markdown explanation → code +
visualization → an `Observations` bullet list**.

```python
# Code and visualization
```

> **Observations**
> * Ob 1
> * Ob 2
> * Ob 3

### 6. Conclusion

Markdown only, three parts:

> **Insights** — the outcomes of the notebook.
> **Suggestions** — what to do based on the insights.
> **Possible Next Steps** — areas to expand on.

---

## ML template

ML notebooks are written as a plain, linear sequence of small cells. Import where a
library is first needed, not all at the top. Show each object after creating it.

### Load and inspect

```python
import numpy as np
import pandas as pd

df = pd.read_csv('drug200.csv')
```

```python
df
```

```python
print(df['Age'].isna().values.any())
```

```python
print(df['BP'].isna().sum())
```

### Encode categoricals

```python
from sklearn.preprocessing import LabelEncoder

le = LabelEncoder()

df['Sex'] = le.fit_transform(df['Sex'])
df['BP'] = le.fit_transform(df['BP'])
df['Cholesterol'] = le.fit_transform(df['Cholesterol'])
```

```python
df
```

### Split

```python
from sklearn.model_selection import train_test_split

X = df.drop('Drug', axis=1)
y = df['Drug']

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.4, random_state=140
)
```

```python
y
```

### Fit

```python
from sklearn.tree import DecisionTreeClassifier

dt = DecisionTreeClassifier(criterion='gini')
dt.fit(X_train, y_train)
```

```python
dt
```

### Predict

```python
ypred = dt.predict(X_test)
```

### Evaluate

```python
from sklearn.metrics import confusion_matrix, accuracy_score, classification_report

cm = confusion_matrix(y_test, ypred)
acc = accuracy_score(y_test, ypred)
cr = classification_report(y_test, ypred)
```

```python
cm
```

```python
import seaborn as sns
import matplotlib.pyplot as plt

plt.figure(figsize=(8, 6))
sns.heatmap(cm, annot=True, fmt='d', cmap="viridis")
plt.title(f'Confusion Matrix - Accuracy : {acc * 100}%')
plt.xlabel('Predicted labels')
plt.ylabel('True labels')
plt.show()
```

```python
print(f'{acc * 100}%')
```

```python
print(cr)
```

### Feature importance

```python
dt.feature_importances_
```

```python
feature_importance = pd.DataFrame({'dt': dt.feature_importances_}, index=X.columns)
feature_importance.sort_values('dt', ascending=True, inplace=True)
```

```python
plt.figure(figsize=(10, 6))
sns.barplot(x='dt', y=feature_importance.index, data=feature_importance, palette='viridis')
plt.title('Feature Importance')
plt.xlabel('Importance Score')
plt.show()
```

### Visualize the tree

```python
from sklearn.tree import plot_tree

plt.figure(figsize=(20, 20))
plot_tree(
    dt,
    feature_names=X.columns,
    class_names=y.unique(),
    max_depth=3,
    filled=True,
)
plt.show()
```

### Hyperparameter tuning

Written as an explicit loop so the reader sees the train/validation gap at each
setting, not hidden inside `GridSearchCV`.

```python
best_max_d = 0
best_validation_accuracy = 0

for max_d in range(1, 10):
    dt = DecisionTreeClassifier(max_depth=max_d, random_state=2)
    dt.fit(X_train, y_train)

    training_accuracy = dt.score(X_train, y_train)
    validation_accuracy = dt.score(X_test, y_test)

    print('The Training Accuracy for max_depth {} is: {}'.format(max_d, training_accuracy))
    print('The Validation Accuracy for max_depth {} is: {}'.format(max_d, validation_accuracy))
    print('')

    if validation_accuracy > best_validation_accuracy:
        best_max_d = max_d
        best_validation_accuracy = validation_accuracy

print("The best max_depth found is:", best_max_d)
```

Follow the loop with a markdown cell reading the result: which depth won, and what the
train/validation gap tells us about overfitting.

---

## Quick checklist before saving a notebook

- [ ] Every code cell does one thing and shows its output.
- [ ] Every preprocessing step has an `assert` after it.
- [ ] Every plot has a title and axis labels.
- [ ] Every randomised call has `random_state=`.
- [ ] Every section ends with an interpretation (Observations / takeaway).
- [ ] Sections appear in the fixed template order.
