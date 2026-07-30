# Free LLM Setup — Mentra

Mentra is built to run entirely on free-tier APIs. No credit card, no Anthropic/OpenAI subscription needed.

## 1. Get a Gemini API key (does generation + embeddings)
1. Go to https://aistudio.google.com/apikey
2. Sign in with a Google account, click "Create API key"
3. Copy it into `.env` as `GEMINI_API_KEY`

Free tier is generous enough for a hackathon build and demo — rate limits reset daily, no billing required.

## 2. Install the SDK
```bash
pip install google-generativeai --break-system-packages
```

## 3. Generation call (used for: concept extraction, grounded answers, quiz generation/validation, misconception explanations)
```python
import google.generativeai as genai
import os

genai.configure(api_key=os.environ["GEMINI_API_KEY"])
model = genai.GenerativeModel("gemini-2.0-flash")

response = model.generate_content(
    "Extract 8-15 key concepts from this text, each with a one-line "
    "summary and suggested prerequisite concepts. Return JSON only.\n\n"
    f"{document_text}"
)
print(response.text)
```

## 4. Embeddings call (used for: chunk embeddings, retrieval)
```python
result = genai.embed_content(
    model="models/text-embedding-004",
    content="Gradient descent is an optimization algorithm...",
    task_type="retrieval_document"
)
embedding_vector = result["embedding"]
```
Use `task_type="retrieval_query"` when embedding the student's question instead of a document chunk — this improves retrieval quality slightly, it's not just a formality.

## 5. Optional: Groq for low-latency calls during the live demo
Groq free tier is extremely fast, useful specifically for quiz grading / misconception explanation where you want an instant response in front of judges.

1. Get a key at https://console.groq.com/keys
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

## Where each is used in Mentra
| Feature | Recommended provider | Why |
|---|---|---|
| Concept extraction | Gemini | One-off call, quality matters more than speed |
| Chunk + query embeddings | Gemini | Same provider as generation, simpler pipeline |
| Grounded answer + reliability scoring | Gemini | Needs to follow citation instructions carefully |
| Quiz generation + validator | Gemini | Two-call pattern, quality matters |
| Quiz grading / misconception explanation | Groq (or Gemini if you skip Groq setup) | This is the call judges see live — speed matters most here |

## Fallback: fully offline option
If you want zero API dependency at all (e.g. unreliable venue wifi), Ollama running `llama3.2` or `phi3` locally works too — free, offline, but slower and lower quality than Gemini. Only worth it if you've tested your demo machine can run it smoothly beforehand.
