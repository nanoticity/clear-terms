import pandas as pd

cases = pd.read_csv("data/cases.csv")
points = pd.read_csv("data/points.csv")

# Only use approved points with actual quote text
clean = points[
    (points["status"] == "approved") & 
    (points["quote_text"].notna())
]

# Join with cases to get classification labels
merged = clean.merge(cases[["id", "classification"]], 
                     left_on="case_id", 
                     right_on="id")

print(f"Clean training examples: {len(merged)}")
print(merged["classification"].value_counts())
print(merged[["quote_text", "classification"]].head(3))
