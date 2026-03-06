import requests
import os

os.makedirs("data", exist_ok=True)

files = ["cases.csv", "points.csv", "services.csv", "topics.csv", "documents.csv"]

base_url = "https://zenodo.org/records/15012282/files"

for filename in files:
    print(f"Downloading {filename}...")
    response = requests.get(f"{base_url}/{filename}")
    
    if response.status_code == 200:
        with open(f"data/{filename}", "wb") as f:
            f.write(response.content)
        print(f"✓ Saved {filename}")
    else:
        print(f"✗ Failed {filename} — status {response.status_code}")

print("Done!")
