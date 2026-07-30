"""
Central prompt utility module for Mentra Extension Spec 5: Multilingual & Simplify Mode.
Threads target_language and simplify_mode parameters directly into Gemini LLM calls.
"""

SUPPORTED_LANGUAGES = {
    'en': 'English',
    'hi': 'Hindi',
    'ta': 'Tamil',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'zh': 'Chinese (Simplified)',
    'ja': 'Japanese',
    'kn': 'Kannada',
    'te': 'Telugu',
    'mr': 'Marathi',
    'bn': 'Bengali'
}

def get_language_name(lang_code: str) -> str:
    return SUPPORTED_LANGUAGES.get(str(lang_code).lower(), 'English')

def build_multilingual_prompt_suffix(lang_code: str = 'en', simplify_mode: bool = False) -> str:
    """
    Builds the mandatory multilingual & simplify instruction block to be appended at the end of LLM prompts.
    """
    lang_name = get_language_name(lang_code)
    
    instructions = [
        f"\n\n--- MULTILINGUAL & SIMPLIFY INSTRUCTION BLOCK ---",
        f"Respond in {lang_name}."
    ]

    if lang_code and str(lang_code).lower() != 'en':
        instructions.append(
            f"If the source material is in a different language than {lang_name}, still generate your response in "
            f"{lang_name}, but preserve technical terms, proper nouns, and citations exactly as they appear in the source "
            f"where translating them would lose precision (e.g. keep 'IaaS', 'PaaS', specific model names, or formulas unchanged)."
        )

    if simplify_mode:
        instructions.append(
            "Additionally, explain this as simply as possible, as if to someone encountering this topic for the first time — "
            "short sentences, common words, minimal jargon, but do not sacrifice factual accuracy from the source material."
        )

    return " ".join(instructions)
