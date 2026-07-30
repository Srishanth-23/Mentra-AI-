import os
import json
import re
from typing import List, Dict, Any, Tuple
from dotenv import load_dotenv

def generate_grounded_answer(
    question: str, 
    candidate_chunks: List[Dict[str, Any]], 
    lang_code: str = 'en', 
    simplify_mode: bool = False
) -> Tuple[str, List[Dict[str, Any]], str]:
    """
    Two-pass RAG generation with strict source grounding and evidence scoring.
    Pass 1: Score candidate chunks for relevance to the question.
    Pass 2: Generate answer strictly grounded in surviving relevant chunks with multilingual support.
    """
    if not candidate_chunks:
        return (
            "No relevant study material chunks were found for this query in your document.",
            [],
            "Low"
        )

    # Pass 1: Simple relevance filter on candidate chunks
    q_words = set(re.findall(r'\w+', question.lower()))
    scored_chunks = []
    
    for chunk in candidate_chunks:
        c_text = chunk.get("text", "")
        c_words = set(re.findall(r'\w+', c_text.lower()))
        overlap = len(q_words.intersection(c_words))
        scored_chunks.append({
            "chunk_id": chunk.get("id", 0),
            "page_num": chunk.get("page_num", 1),
            "text": c_text,
            "relevance_score": overlap
        })

    # Sort chunks by relevance
    scored_chunks.sort(key=lambda x: x["relevance_score"], reverse=True)
    surviving_chunks = [c for c in scored_chunks if c["relevance_score"] > 0]
    
    if not surviving_chunks:
        surviving_chunks = scored_chunks[:2]

    # Calculate Grounding Strength
    total_relevance = sum(c["relevance_score"] for c in surviving_chunks)
    if total_relevance >= 6:
        grounding_strength = "High"
    elif total_relevance >= 2:
        grounding_strength = "Medium"
    else:
        grounding_strength = "Low"

    # Build citations list
    citations = []
    for c in surviving_chunks[:3]:
        snippet = c["text"][:140].rstrip() + "..."
        citations.append({
            "chunk_id": c["chunk_id"],
            "page": c["page_num"],
            "snippet": snippet
        })

    # Pass 2: Grounded LLM Generation
    load_dotenv(override=True)
    key = os.environ.get("GEMINI_API_KEY", "").strip()

    chunks_formatted = "\n\n".join([
        f"[Chunk #{c['chunk_id']} | Page {c['page_num']}]\n{c['text']}"
        for c in surviving_chunks
    ])

    if not key:
        # Grounded fallback when API key is unconfigured
        answer = f"### Grounded Response for: {question}\n\n"
        answer += f"Based on your uploaded notes (Page {surviving_chunks[0]['page_num']}):\n\n"
        answer += surviving_chunks[0]['text'][:400] + "...\n\n"
        answer += "*Key concepts and definitions are grounded in your course study material.*"
        return answer, citations, grounding_strength

    try:
        from services.key_manager import call_gemini_with_key_rotation
        from services.prompt_utils import build_multilingual_prompt_suffix

        multilingual_suffix = build_multilingual_prompt_suffix(lang_code, simplify_mode)

        prompt = f"""
You are Mentra Tutor, an evidence-grounded academic teaching copilot.
Answer the student's question directly, clearly, and thoroughly using the provided course study material.

Student Question: "{question}"

Instructions:
1. Provide a clear, well-structured explanation starting with main concepts.
2. Bold key technical terms for visual clarity.
3. If an architectural system or workflow is described, include a clean Mermaid diagram block (```mermaid ... ```).
4. Do NOT include conversational meta-text like "Based on the provided notes...". Focus purely on teaching the content.

Study Material Chunks:
{chunks_formatted}
{multilingual_suffix}
        """

        raw_answer = call_gemini_with_key_rotation(prompt)
        return raw_answer.strip(), citations, grounding_strength
    except Exception as e:
        print(f"Grounded answer generation error: {e}")
        fallback_ans = f"Based on your notes (Page {surviving_chunks[0]['page_num']}):\n\n{surviving_chunks[0]['text'][:350]}..."
        return fallback_ans, citations, "Low"
