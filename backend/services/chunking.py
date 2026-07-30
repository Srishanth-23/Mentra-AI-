import fitz  # PyMuPDF
from typing import List, Dict, Any
from collections import Counter

def strip_repeated_headers(pages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Remove lines that appear near-identically on most pages (headers/footers/logos).
    Threshold: lines appearing on >= 60% of pages and shorter than 100 chars.
    """
    if len(pages) <= 1:
        return pages

    line_counts = Counter()
    for page in pages:
        for line in set(page["text"].strip().split("\n")):
            cleaned_line = line.strip()
            if cleaned_line:
                line_counts[cleaned_line] += 1

    threshold = max(2, len(pages) * 0.6)
    boilerplate = {line for line, count in line_counts.items() if count >= threshold and len(line) < 100}

    cleaned_pages = []
    for page in pages:
        lines = [l for l in page["text"].split("\n") if l.strip() not in boilerplate]
        cleaned_pages.append({
            "page_num": page["page_num"],
            "text": "\n".join(lines)
        })
    return cleaned_pages

def parse_pdf_bytes(file_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Parses PDF bytes into pages with page numbers and text.
    Strips repeated headers and footers across pages.
    """
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    pages = []
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text("text").strip()
        if text:
            pages.append({
                "page_num": page_num + 1,
                "text": text
            })
    return strip_repeated_headers(pages)

def chunk_pages(pages: List[Dict[str, Any]], target_chunk_words: int = 350, overlap_words: int = 40) -> List[Dict[str, Any]]:
    """
    Chunks document pages into overlapping text blocks.
    Each chunk retains its page number and text snippet.
    """
    chunks = []
    current_chunk_words = []
    current_page = 1

    for page in pages:
        page_words = page["text"].split()
        page_num = page["page_num"]

        for word in page_words:
            if not current_chunk_words:
                current_page = page_num

            current_chunk_words.append(word)

            if len(current_chunk_words) >= target_chunk_words:
                chunk_text = " ".join(current_chunk_words)
                chunks.append({
                    "page_num": current_page,
                    "text": chunk_text
                })
                # Overlap: keep the last overlap_words
                current_chunk_words = current_chunk_words[-overlap_words:]

    if current_chunk_words:
        chunk_text = " ".join(current_chunk_words)
        chunks.append({
            "page_num": current_page,
            "text": chunk_text
        })

    return chunks
