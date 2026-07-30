import os
import itertools
from dotenv import load_dotenv
import google.generativeai as genai

# Internal lock index for round-robin rotation
_key_cycle = None
_all_keys = []

def get_all_gemini_keys():
    load_dotenv(override=True)
    raw_keys = os.environ.get("GEMINI_API_KEYS", "") + "," + os.environ.get("GEMINI_API_KEY", "")

    keys = []
    for k in raw_keys.split(","):
        k_clean = k.strip()
        if k_clean and k_clean not in keys:
            keys.append(k_clean)

    return keys

def get_next_gemini_key():
    global _key_cycle, _all_keys
    keys = get_all_gemini_keys()
    if not keys:
        return ""

    if _key_cycle is None or set(keys) != set(_all_keys):
        _all_keys = keys
        _key_cycle = itertools.cycle(keys)

    return next(_key_cycle)

def call_gemini_with_key_rotation(prompt: str, candidate_models=None):
    """
    Attempts to call Gemini across available API keys and model candidates.
    If a key hits 429 quota, it immediately rotates to the next available key!
    """
    keys = get_all_gemini_keys()
    if not keys:
        raise ValueError("No Gemini API keys found in backend/.env")

    if candidate_models is None:
        candidate_models = ["gemini-flash-latest", "gemini-2.0-flash", "gemini-2.0-flash-lite"]

    # Try each key in rotation
    for key in keys:
        genai.configure(api_key=key)
        for model_name in candidate_models:
            try:
                model = genai.GenerativeModel(model_name)
                res = model.generate_content(prompt)
                if res and res.text:
                    return res.text.strip()
            except Exception as e:
                err_msg = str(e)
                if "429" in err_msg or "ResourceExhausted" in err_msg:
                    print(f"Key {key[:10]}... hit 429 rate limit on {model_name}, rotating to next key...")
                    break  # Rotate to next key immediately
                continue

    raise RuntimeError("All Gemini API keys exhausted or rate-limited.")
