from agent.retriever import Retriever
import ollama

class LLMQA:
    def __init__(self, model="llama3"):
        self.retriever = Retriever()
        self.model = model

    def build_prompt(self, question: str, context: str) -> str:
        return f"""
You are a GraphQL schema expert.

Using the following GraphQL schema context, answer the user's question.

### Question:
{question}

### Schema Context:
{context}

### Answer:
"""

    def answer(self, question: str, top_k: int = 5) -> str:
        chunks = self.retriever.retrieve_chunks(question, top_k=top_k)
        context = self.retriever.format_context(chunks)
        prompt = self.build_prompt(question, context)

        response = ollama.chat(model=self.model, messages=[
            { "role": "user", "content": prompt }
        ])
        return response['message']['content'].strip()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Ask a question about the GraphQL schema using a local Ollama model.")
    parser.add_argument("--question", required=True, help="The question to ask the schema-aware LLM agent.")
    parser.add_argument("--top_k", type=int, default=5, help="Number of top schema chunks to include in context.")
    parser.add_argument("--model", default="llama3", help="Ollama model to use (e.g., llama3, codellama, mistral)")

    args = parser.parse_args()

    qa_agent = LLMQA(model=args.model)
    answer = qa_agent.answer(args.question, top_k=args.top_k)

    print("\nAnswer:")
    print(answer)
