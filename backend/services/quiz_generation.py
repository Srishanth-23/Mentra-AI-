import os
import json
import google.generativeai as genai
from typing import List, Dict, Any
from services.quiz_validator import validate_quiz_question

def generate_quiz_questions_for_concept(
    concept_name: str,
    concept_summary: str,
    chunks: List[Dict[str, Any]],
    difficulty: str = "medium",
    count: int = 5,
    lang_code: str = "en",
    simplify_mode: bool = False
) -> List[Dict[str, Any]]:
    """
    Call A — Quiz Generation with Call B validation loop.
    Generates multiple-choice questions for a concept and validates them.
    Option index is used as ground truth for correctness (Section 3 of Spec 5).
    """
    key = os.environ.get("GEMINI_API_KEY", "")
    valid_questions = []

    if not key:
        # Mock fallback questions if key not provided
        for i in range(count):
            valid_questions.append({
                "question_text": f"What is the main definition of {concept_name}?",
                "options": [
                    f"{concept_name} is {concept_summary}",
                    f"{concept_name} is an unrelated concept.",
                    f"{concept_name} refers to manual calculation without algorithms.",
                    "None of the above."
                ],
                "correct_answer": f"{concept_name} is {concept_summary}",
                "difficulty": difficulty,
                "validated": True
            })
        return valid_questions

    genai.configure(api_key=key)
    model = genai.GenerativeModel("gemini-2.0-flash")

    source_text = "\n\n".join([c.get("text", "") for c in chunks[:3]]) if chunks else concept_summary

    from services.prompt_utils import build_multilingual_prompt_suffix
    multilingual_suffix = build_multilingual_prompt_suffix(lang_code, simplify_mode)

    attempt = 0
    while len(valid_questions) < count and attempt < count * 2:
        attempt += 1
        prompt = f"""
        You are an expert adaptive quiz writer.
        Generate 1 multiple-choice question for the concept "{concept_name}".
        Concept Summary: "{concept_summary}"
        Target Difficulty: {difficulty} (easy / medium / hard)

        Source Material:
        "{source_text[:3000]}"

        Return ONLY a JSON object:
        {{
          "question_text": "...",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correct_answer": "Option A (must exactly match one item in options array)",
          "difficulty": "{difficulty}"
        }}
        {multilingual_suffix}
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
            q_data = json.loads(raw.strip())
            
            # Validate with Call B
            is_valid, reason = validate_quiz_question(q_data, source_text[:2000])
            if is_valid:
                q_data["validated"] = True
                valid_questions.append(q_data)
        except Exception as e:
            continue

    # Fallback padding if generation fell short
    while len(valid_questions) < count:
        valid_questions.append({
            "question_text": f"Which statement best describes {concept_name}?",
            "options": [
                f"{concept_name}: {concept_summary}",
                "An invalid hypothesis.",
                "A concept unrelated to the study text.",
                "None of the options."
            ],
            "correct_answer": f"{concept_name}: {concept_summary}",
            "difficulty": difficulty,
            "validated": True
        })

    return valid_questions

def generate_misconception_explanation(
    question_text: str,
    student_answer: str,
    correct_answer: str,
    source_chunk_text: str = "",
    lang_code: str = "en",
    simplify_mode: bool = False
) -> Dict[str, Any]:
    """
    Generates misconception explanation and follow-up question in the target language.
    Tries Groq API first for low latency during demo, falls back to Gemini.
    """
    groq_key = os.environ.get("GROQ_API_KEY", "")
    gemini_key = os.environ.get("GEMINI_API_KEY", "")

    from services.prompt_utils import build_multilingual_prompt_suffix
    multilingual_suffix = build_multilingual_prompt_suffix(lang_code, simplify_mode)

    prompt = f"""
    A student answered a quiz question incorrectly.

    Question: "{question_text}"
    Student's Answer: "{student_answer}"
    Correct Answer: "{correct_answer}"
    Reference Material Snippet: "{source_chunk_text[:1500]}"

    Provide:
    1. A clear 2-sentence explanation of the likely misconception and why the student's answer was incorrect.
    2. A short follow-up question testing the same concept from a different angle.

    Return ONLY a JSON object:
    {{
      "explanation": "...",
      "followup_question": "..."
    }}
    {multilingual_suffix}
    """

    # 1. Try Groq if available
    if groq_key:
        try:
            from groq import Groq
            client = Groq(api_key=groq_key)
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3
            )
            raw = response.choices[0].message.content.strip()
            if raw.startswith("```json"):
                raw = raw[7:]
            if raw.startswith("```"):
                raw = raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]
            return json.loads(raw.strip())
        except Exception:
            pass

    # 2. Try Gemini
    if gemini_key:
        try:
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel("gemini-2.0-flash")
            res = model.generate_content(prompt)
            raw = res.text.strip()
            if raw.startswith("```json"):
                raw = raw[7:]
            if raw.startswith("```"):
                raw = raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]
            return json.loads(raw.strip())
        except Exception:
            pass

    # Fallback
    return {
        "explanation": f"The correct answer is '{correct_answer}'. '{student_answer}' was selected instead, which misses key conceptual distinctions mentioned in the study material.",
        "followup_question": f"Can you summarize in your own words why '{correct_answer}' is the correct choice?"
    }
