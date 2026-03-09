import requests
import os
import time

try:
    from tqdm import tqdm

    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
BASE_URL = "https://zenodo.org/records/15012282/files"
FILES = ["cases.csv", "points.csv", "services.csv", "topics.csv", "documents.csv"]
MAX_RETRIES = 3
CHUNK_SIZE = 8192


def download_file(filename):
    url = f"{BASE_URL}/{filename}"
    dest = os.path.join(DATA_DIR, filename)

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.get(url, stream=True, timeout=60)
            resp.raise_for_status()

            total = int(resp.headers.get("Content-Length", 0))

            if HAS_TQDM and total:
                progress = tqdm(total=total, unit="B", unit_scale=True, desc=filename)
            else:
                progress = None
                print(f"Downloading {filename}...")

            with open(dest, "wb") as f:
                for chunk in resp.iter_content(chunk_size=CHUNK_SIZE):
                    f.write(chunk)
                    if progress:
                        progress.update(len(chunk))

            if progress:
                progress.close()

            print(f"Saved {filename}")
            return True

        except (requests.RequestException, IOError) as e:
            print(f"Attempt {attempt}/{MAX_RETRIES} failed for {filename}: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(2**attempt)

    print(f"FAILED to download {filename} after {MAX_RETRIES} attempts")
    return False


def main():
    os.makedirs(DATA_DIR, exist_ok=True)

    results = [download_file(f) for f in FILES]

    succeeded = sum(results)
    print(f"\nDone! {succeeded}/{len(FILES)} files downloaded.")
    if not all(results):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
