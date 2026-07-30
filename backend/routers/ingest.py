import json
from fastapi import APIRouter, UploadFile, File, HTTPException
from models.db import get_db_connection
from services.chunking import parse_pdf_bytes, chunk_pages
from services.embeddings import embed_texts, get_or_create_index
from services.concept_extraction import extract_concepts_from_text
from services.mastery_engine import calculate_concept_mastery

router = APIRouter()

@router.post("/ingest")
async def ingest_document(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf") and not file.filename.endswith(".txt"):
        raise HTTPException(status_code=400, detail="Only PDF and TXT files are supported.")

    file_bytes = await file.read()
    
    # 1. Parse document text
    if file.filename.endswith(".pdf"):
        pages = parse_pdf_bytes(file_bytes)
    else:
        text_content = file_bytes.decode("utf-8", errors="ignore")
        pages = [{"page_num": 1, "text": text_content}]

    if not pages:
        raise HTTPException(status_code=400, detail="Document text could not be extracted.")

    full_text = "\n\n".join([p["text"] for p in pages])

    # 2. Chunk text
    chunks = chunk_pages(pages, target_chunk_words=350, overlap_words=40)

    # 3. Perform external LLM/embedding operations BEFORE opening DB transaction
    chunk_texts = [c["text"] for c in chunks]
    embeddings = embed_texts(chunk_texts, task_type="retrieval_document")
    raw_concepts = extract_concepts_from_text(full_text)

    # 4. Save Document, Chunks, and Concepts into DB in a fast atomic transaction
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("INSERT INTO documents (filename) VALUES (?)", (file.filename,))
    doc_id = cursor.lastrowid

    faiss_manager = get_or_create_index(doc_id)
    saved_chunks = []

    for c, emb in zip(chunks, embeddings):
        # Store vector as BLOB if present
        emb_blob = bytes(json.dumps(emb), "utf-8") if emb else None
        cursor.execute(
            "INSERT INTO chunks (document_id, text, page_num, embedding_vector) VALUES (?, ?, ?, ?)",
            (doc_id, c["text"], c["page_num"], emb_blob)
        )
        chunk_db_id = cursor.lastrowid
        chunk_obj = {
            "id": chunk_db_id,
            "document_id": doc_id,
            "text": c["text"],
            "page_num": c["page_num"]
        }
        saved_chunks.append((chunk_obj, emb))

    faiss_manager.add_chunks([sc[0] for sc in saved_chunks], [sc[1] for sc in saved_chunks])

    # Save concepts to DB
    saved_concepts = []
    name_to_id = {}

    # First pass: Insert concept names & summaries with exam_frequency
    for concept in raw_concepts:
        exam_freq = concept.get("exam_frequency", 0)
        cursor.execute(
            "INSERT INTO concepts (document_id, name, summary, prerequisite_ids, exam_frequency) VALUES (?, ?, ?, ?, ?)",
            (doc_id, concept.get("name", "Core Concept"), concept.get("summary", ""), json.dumps([]), exam_freq)
        )
        c_id = cursor.lastrowid
        name_to_id[concept.get("name", "").strip().lower()] = c_id
        saved_concepts.append({
            "id": c_id,
            "name": concept.get("name"),
            "summary": concept.get("summary"),
            "exam_frequency": exam_freq,
            "suggested_prerequisites_raw": concept.get("suggested_prerequisites", [])
        })

    # Second pass: Resolve prerequisite IDs
    final_concepts_output = []
    for concept in saved_concepts:
        prereq_ids = []
        for p_name in concept["suggested_prerequisites_raw"]:
            p_clean = str(p_name).strip().lower()
            if p_clean in name_to_id and name_to_id[p_clean] != concept["id"]:
                prereq_ids.append(name_to_id[p_clean])

        cursor.execute(
            "UPDATE concepts SET prerequisite_ids = ? WHERE id = ?",
            (json.dumps(prereq_ids), concept["id"])
        )

    # Commit concept rows before linking global memory & calculating mastery scores
    conn.commit()

    # Link concepts to cross-document global memory
    from services.global_memory_service import link_concepts_to_global_memory, get_concept_global_history
    link_concepts_to_global_memory(doc_id, saved_concepts)

    for concept in saved_concepts:
        prereq_ids = [name_to_id[str(p).strip().lower()] for p in concept["suggested_prerequisites_raw"] if str(p).strip().lower() in name_to_id and name_to_id[str(p).strip().lower()] != concept["id"]]
        
        # Initialize baseline mastery score
        calculate_concept_mastery(concept["id"], external_conn=conn)

        history = get_concept_global_history(concept["id"])

        final_concepts_output.append({
            "id": concept["id"],
            "name": concept["name"],
            "summary": concept["summary"],
            "suggested_prerequisites": prereq_ids,
            "global_history": history
        })

    conn.commit()
    conn.close()

    return {
        "document_id": doc_id,
        "filename": file.filename,
        "concepts": final_concepts_output
    }
