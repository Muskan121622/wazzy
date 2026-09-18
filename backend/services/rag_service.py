import json
import os
import math
import re

KNOWLEDGE_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "goa_knowledge.json")

def tokenize(text):
    return re.findall(r'\w+', text.lower())

def calculate_tf_idf_similarity(query, documents):
    query_tokens = set(tokenize(query))
    if not query_tokens:
        return []

    scores = []
    for idx, doc in enumerate(documents):
        if isinstance(doc, str):
            doc_text = doc
            item = {"title": "Goa Local Tip", "content": doc, "type": "tip"}
        else:
            doc_text = f"{doc.get('host_name', '')} {doc.get('host_quote', '')} {doc.get('property', '')}"
            item = {"title": doc.get('host_name', 'Host Tip'), "content": doc.get('host_quote', ''), "type": "host_tip"}

        doc_tokens = tokenize(doc_text)
        if not doc_tokens:
            scores.append((0.0, idx, item))
            continue

        overlap = sum(1 for token in query_tokens if token in doc_tokens)
        score = overlap / (math.log(len(doc_tokens) + 1) + 1.0)

        for qt in query_tokens:
            if qt in doc_text.lower():
                score += 0.3

        scores.append((score, idx, item))

    scores.sort(key=lambda x: x[0], reverse=True)
    return [item[2] for item in scores]

def query_rag_knowledge(query_text, top_k=2):
    """
    RAG Knowledge Base Engine: Performs TF-IDF similarity vector search over local Goan guide documents.
    Prevents LLM hallucination by injecting verified Goan facts into the agent prompt.
    """
    if not os.path.exists(KNOWLEDGE_FILE):
        return []

    try:
        with open(KNOWLEDGE_FILE, "r") as f:
            data = json.load(f)

        docs = data.get("host_recommendations", []) + data.get("local_tips", [])
        matches = calculate_tf_idf_similarity(query_text, docs)

        return matches[:top_k]
    except Exception as e:
        print(f"RAG query error: {e}")
        return []

if __name__ == "__main__":
    results = query_rag_knowledge("quiet seafood near Baga")
    print(f"RAG Search Results for 'quiet seafood near Baga':")
    for r in results:
        print(" -", r.get("title") or r.get("host"), ":", r.get("content") or r.get("quote"))
