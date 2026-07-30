import os
import sys
import json

def test_imports():
    print("Testing backend module imports...")
    from models.db import init_db, get_db_connection
    from services.chunking import chunk_pages
    from services.embeddings import FAISSIndexManager
    from services.reliability_scoring import generate_grounded_answer
    from services.mastery_engine import calculate_concept_mastery
    from services.recovery_engine import generate_recovery_plan
    from main import app

    init_db()
    print("All backend imports and database initialization succeeded!")

if __name__ == "__main__":
    test_imports()
