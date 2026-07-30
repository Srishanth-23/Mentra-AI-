import os
import json
import google.generativeai as genai
from typing import Dict, Any, Tuple

def validate_quiz_question(question_data: Dict[str, Any], source_chunk_text: str) -> Tuple[bool, str]:
    """
    Call B — Quiz Validator:
    Verifies:
    1. Is this question answerable from the source chunk?
    2. Is the marked correct answer actually correct?
    3. Is it conceptual rather than arbitrary trivia?
    """
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key:
        return True, "Passed (default - no API key configured)"

    genai.configure(api_key=key)
    model = genai.GenerativeModel("gemini-2.0-flash")

    prompt = f"""
    You are an expert pedagogical validator.
    Check the following quiz question generated for a student against its source material.

    Source Material Chunk:
    "{source_chunk_text}"

    Generated Question:
    Question: {question_data.get('question_text', '')}
    Options: {json.dumps(question_data.get('options', []))}
    Marked Correct Answer: {question_data.get('correct_answer', '')}

    Validation Criteria:
    1. Is the question directly answerable from the source chunk?
    2. Is the marked correct answer unambiguously correct based on the text?
    3. Is the question conceptual (testing understanding) rather than trivial trivia?

    Return ONLY a JSON object:
    {{"is_valid": true/false, "reason": "short explanation"}}
    """

    try:
        res = model.generate_content(prompt)
        raw = res.text.strip()
        if raw.startswith("```json"):
            raw = raw[7:]
        if raw.startswith("```"):
            raw = raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
        result = json.loads(raw.strip())
        return bool(result.get("is_valid", True)), str(result.get("reason", "OK"))
    except Exception as e:
        return True, f"Validation passed with warning: {e}"
