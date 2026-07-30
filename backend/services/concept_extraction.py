import os
import json
import re
from typing import List, Dict, Any
from dotenv import load_dotenv

EXAM_TAG_PATTERN = re.compile(
    r'\((?:Nov|Dec|May|Apr|Jan|Jun|Jul|Aug|Sep|Oct)[/\-]?(?:Nov|Dec|May|Apr|Jan|Jun|Jul|Aug|Sep|Oct)?\s*[\'\-]?\d{2,4}\)',
    re.IGNORECASE
)

METADATA_NOISE_PATTERNS = [
    r'subject\s*code', r'subject\s*name', r'course\s*objectives?', r'course\s*outcomes?',
    r'co-po\s*mapping', r'department', r'batch', r'year/sem', r'academic\s*year',
    r'rbt\s*level', r'accreditation', r'institution\s*name', r'syllabus'
]

def strip_oneoff_metadata(text: str) -> str:
    """Pre-filter dropping lines or paragraphs matching administrative cover-page metadata patterns."""
    lines = text.split("\n")
    cleaned_lines = []
    for line in lines:
        line_upper = line.strip().lower()
        if any(re.search(pat, line_upper) for pat in METADATA_NOISE_PATTERNS) and len(line) < 120:
            continue
        cleaned_lines.append(line)
    return "\n".join(cleaned_lines)

def detect_exam_frequency(full_text: str, concept_name: str) -> int:
    """Detect how many exam date tags (e.g. Nov/Dec 2020) appear near a concept's text."""
    matches = EXAM_TAG_PATTERN.findall(full_text)
    if not matches:
        return 0

    concept_lower = concept_name.lower()
    keywords = [w for w in concept_lower.split() if len(w) > 3]

    count = 0
    for line in full_text.split("\n"):
        line_lower = line.lower()
        if concept_lower in line_lower or (keywords and any(kw in line_lower for kw in keywords)):
            count += len(EXAM_TAG_PATTERN.findall(line))

    return count if count > 0 else (1 if len(matches) > 0 else 0)

def extract_concepts_from_text(full_text: str) -> List[Dict[str, Any]]:
    # Force reload .env
    load_dotenv(override=True)
    key = os.environ.get("GEMINI_API_KEY", "").strip()

    # Pre-filter metadata text before sending to LLM
    clean_text = strip_oneoff_metadata(full_text)

    try:
        from services.key_manager import call_gemini_with_key_rotation

        prompt = f"""
Extract 8 to 15 core ACADEMIC concepts from this document — the actual subject
matter a student needs to learn, not administrative metadata.

Explicitly ignore: subject codes, subject names, department names, course
codes, batch/year/semester info, course objectives, course outcomes tables,
PO-PSO mapping tables, institution names, accreditation info, and page
headers/footers.

Only extract concepts that represent a teachable idea, technique, model,
or system.

For each concept return:
- "name": Concise academic topic title (3 to 6 words max, e.g. "Cloud Architecture & Layered Design")
- "summary": 1-2 sentences written from the actual explanatory content, not copied metadata
- "suggested_prerequisites": list of prerequisite concept names from elsewhere in this list

Return JSON list of objects with keys "name", "summary", "suggested_prerequisites". No preamble.

Course Material Text:
{clean_text[:18000]}
        """

        raw_text = call_gemini_with_key_rotation(prompt)
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        if raw_text.startswith("```"):
            raw_text = raw_text[3:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]

        concepts = json.loads(raw_text.strip())
        if isinstance(concepts, list) and len(concepts) > 0:
            filtered = []
            for c in concepts:
                name_upper = str(c.get("name", "")).upper()
                if not any(re.search(pat, name_upper.lower()) for pat in METADATA_NOISE_PATTERNS):
                    c["exam_frequency"] = detect_exam_frequency(full_text, c.get("name", ""))
                    filtered.append(c)
            if filtered:
                return filtered
    except Exception as e:
        print(f"Concept extraction LLM error: {e}")

    # Section-Based Text Splitter Fallback
    section_blocks = re.split(r'\n(?=[0-9]+\.|\b[A-Z0-9\s]{4,40}\b\n)', clean_text)
    extracted_concepts = []
    prev_name = None

    for block in section_blocks:
        block_lines = [l.strip() for l in block.split("\n") if l.strip()]
        if not block_lines:
            continue

        title_candidate = block_lines[0]
        title_lower = title_candidate.lower()

        if any(re.search(pat, title_lower) for pat in METADATA_NOISE_PATTERNS) or len(title_candidate) < 4 or ":" in title_candidate:
            continue

        clean_title = re.sub(r'^[0-9.#\-\*\s]+', '', title_candidate).strip()
        if not clean_title or len(clean_title.split()) > 7:
            continue

        body_text = " ".join(block_lines[1:6])
        summary = (body_text[:200].rstrip() + "...") if len(body_text) > 30 else f"Core academic mechanisms regarding {clean_title}."
        prereqs = [prev_name] if prev_name else []

        extracted_concepts.append({
            "name": clean_title,
            "summary": summary,
            "suggested_prerequisites": prereqs,
            "exam_frequency": detect_exam_frequency(full_text, clean_title)
        })
        prev_name = clean_title

        if len(extracted_concepts) >= 15:
            break

    if not extracted_concepts:
        extracted_concepts = [
            {
                "name": "Core Subject Architecture",
                "summary": "Primary academic principles and system components.",
                "suggested_prerequisites": [],
                "exam_frequency": 0
            }
        ]

    return extracted_concepts
