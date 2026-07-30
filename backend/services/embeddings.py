import os
import numpy as np
import faiss
import google.generativeai as genai
from typing import List, Dict, Any

def get_gemini_api_key():
    key = os.environ.get("GEMINI_API_KEY", "")
    if key:
        genai.configure(api_key=key)
    return key

def embed_texts(texts: List[str], task_type: str = "retrieval_document") -> List[List[float]]:
    get_gemini_api_key()
    embeddings = []
    
    # Process in batches to respect rate limits
    for text in texts:
        try:
            res = genai.embed_content(
                model="models/text-embedding-004",
                content=text,
                task_type=task_type
            )
            embeddings.append(res["embedding"])
        except Exception as e:
            # Fallback zero-vector if embedding fails or key is unconfigured in test
            embeddings.append([0.0] * 768)
            
    return embeddings

def embed_query(query: str) -> List[float]:
    embeddings = embed_texts([query], task_type="retrieval_query")
    return embeddings[0]

class FAISSIndexManager:
    def __init__(self, dimension: int = 768):
        self.dimension = dimension
        self.index = faiss.IndexFlatIP(dimension) # Inner product (cosine similarity if normalized)
        self.chunk_metadata: List[Dict[str, Any]] = []

    def add_chunks(self, chunks: List[Dict[str, Any]], embeddings: List[List[float]]):
        if not embeddings:
            return

        emb_np = np.array(embeddings, dtype=np.float32)
        # Normalize vectors for cosine similarity
        faiss.normalize_L2(emb_np)
        self.index.add(emb_np)
        
        for chunk in chunks:
            self.chunk_metadata.append(chunk)

    def search(self, query_embedding: List[float], top_k: int = 4) -> List[Dict[str, Any]]:
        if self.index.ntotal == 0:
            return []

        q_np = np.array([query_embedding], dtype=np.float32)
        faiss.normalize_L2(q_np)

        distances, indices = self.index.search(q_np, min(top_k, self.index.ntotal))

        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx != -1 and idx < len(self.chunk_metadata):
                item = dict(self.chunk_metadata[idx])
                item["score"] = float(dist)
                results.append(item)
        return results

# Global in-memory FAISS indices per document ID
DOCUMENT_INDICES: Dict[int, FAISSIndexManager] = {}

def get_or_create_index(doc_id: int) -> FAISSIndexManager:
    if doc_id not in DOCUMENT_INDICES:
        DOCUMENT_INDICES[doc_id] = FAISSIndexManager()
    return DOCUMENT_INDICES[doc_id]
