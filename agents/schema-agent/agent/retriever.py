import json
from pathlib import Path
from agent.embedder import Embedder

class Retriever:
    def __init__(self, index_path="embeddings/index.faiss", metadata_path="embeddings/metadata.json"):
        # Use a known stable embedding model (must match the one used in embedder.py)
        self.embedder = Embedder(model_name="BAAI/bge-base-en-v1.5")
        self.embedder.load(index_path, metadata_path)

    def retrieve_chunks(self, question: str, top_k=5):
        """Retrieve top-k most relevant SDL chunks for the user's question."""
        return self.embedder.search(question, top_k=top_k)

    def format_context(self, results):
        """Format the retrieved chunks into a single prompt-ready context string."""
        return "\n\n---\n\n".join(
            [f"# Source: {Path(path).name}\n\n{content.strip()}" for path, content in results]
        )

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Retrieve relevant schema chunks for a given question.")
    parser.add_argument("--query", required=True, help="Question about the GraphQL schema")
    parser.add_argument("--top_k", type=int, default=5, help="Number of top chunks to retrieve")
    args = parser.parse_args()

    retriever = Retriever()
    chunks = retriever.retrieve_chunks(args.query, top_k=args.top_k)
    context = retriever.format_context(chunks)

    print("\n🔍 Retrieved Context:\n")
    print(context)
