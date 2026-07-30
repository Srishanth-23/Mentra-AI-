#!/usr/bin/env bash
# update_to_free_llm.sh
# Run from the mentra/ project root: bash update_to_free_llm.sh
# Rewrites every doc + .env.example to use free-tier Gemini (+ optional Groq)
# instead of paid Anthropic/OpenAI. Safe to re-run any time.

set -euo pipefail

if [ ! -d "docs" ]; then
  echo "Run this from the mentra/ project root (docs/ folder not found here)."
  exit 1
fi

echo "Updating docs and README..."

# Replace provider references across all markdown docs + README
FILES=$(find . -name "*.md" -not -path "./node_modules/*")

for f in $FILES; do
  sed -i \
    -e 's/Claude\/GPT API/Google Gemini API (free tier)/g' \
    -e 's/OpenAI\/Voyage embeddings/Gemini text-embedding-004 (free)/g' \
    -e 's/Claude or GPT API/Google Gemini API (free tier)/g' \
    -e 's/ANTHROPIC_API_KEY/GEMINI_API_KEY/g' \
    -e 's/OPENAI_API_KEY/GEMINI_API_KEY/g' \
    -e 's/EMBEDDING_API_KEY/GEMINI_API_KEY/g' \
    "$f"
done

echo "Rewriting .env.example..."

cat > .env.example << 'EOF'
# LLM + Embeddings (free tier — get a key at https://aistudio.google.com/apikey)
GEMINI_API_KEY=

# Optional: Groq for faster quiz-grading calls during live demo (free tier)
# https://console.groq.com/keys
GROQ_API_KEY=

# Database
DATABASE_URL=sqlite:///./mentra.db

# App
ENV=development
EOF

echo "Rewriting stack section in README.md..."

python3 - << 'PYEOF'
import re

with open("README.md") as f:
    content = f.read()

new_stack = """## Stack
- Frontend: React + Tailwind
- Backend: FastAPI (Python, async)
- LLM: Google Gemini API (free tier, no card required) — `gemini-2.0-flash` or `gemini-2.5-flash`
- Embeddings + retrieval: Gemini `text-embedding-004` (free) + FAISS
- Optional: Groq (free) for faster quiz-grading calls if latency matters during the demo
- DB: SQLite
- Doc parsing: PyMuPDF

Get a Gemini key at https://aistudio.google.com/apikey — takes under a minute, no billing setup."""

content = re.sub(
    r"## Stack\n(?:.*\n)*?(?=\n## |\Z)",
    new_stack + "\n\n",
    content,
    count=1
)

with open("README.md", "w") as f:
    f.write(content)
PYEOF

# Make sure FREE_LLM_SETUP.md exists; create it if this is a fresh docs/ folder
if [ ! -f "docs/FREE_LLM_SETUP.md" ]; then
  echo "Creating docs/FREE_LLM_SETUP.md..."
  cat > docs/FREE_LLM_SETUP.md << 'EOF'
# Free LLM Setup — Mentra

Mentra runs entirely on free-tier APIs. No credit card, no Anthropic/OpenAI subscription needed.

## 1. Get a Gemini API key (does generation + embeddings)
1. https://aistudio.google.com/apikey
2. Sign in with a Google account, click "Create API key"
3. Copy it into `.env` as `GEMINI_API_KEY`

## 2. Install the SDK
```bash
pip install google-generativeai --break-system-packages
```

## 3. Generation call
```python
import google.generativeai as genai
import os

genai.configure(api_key=os.environ["GEMINI_API_KEY"])
model = genai.GenerativeModel("gemini-2.0-flash")
response = model.generate_content("your prompt here")
print(response.text)
```

## 4. Embeddings call
```python
result = genai.embed_content(
    model="models/text-embedding-004",
    content="text to embed",
    task_type="retrieval_document"  # use "retrieval_query" for the student's question
)
embedding_vector = result["embedding"]
```

## 5. Optional: Groq for low-latency calls during the live demo
1. https://console.groq.com/keys
2. `pip install groq --break-system-packages`
```python
from groq import Groq
client = Groq(api_key=os.environ["GROQ_API_KEY"])
response = client.chat.completions.create(
    model="llama-3.3-70b-versatile",
    messages=[{"role": "user", "content": "..."}]
)
print(response.choices[0].message.content)
```

## Fallback: fully offline
Ollama running `llama3.2` or `phi3` locally — free, offline, slower/lower quality than Gemini. Only worth it if tested beforehand on your demo machine.
EOF
fi

echo ""
echo "Done. Remaining provider references (should be empty or only intentional mentions):"
grep -rniE "anthropic|openai|claude|gpt-4|gpt-3|voyage" --include="*.md" --include=".env.example" . || echo "  (none found)"
