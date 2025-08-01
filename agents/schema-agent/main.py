import argparse
from src.llm_agent import LLMQA

def main():
    parser = argparse.ArgumentParser(
        description="GraphQL Schema QA Agent (RAG using Ollama + FAISS)"
    )
    parser.add_argument(
        "--question",
        required=True,
        help="Ask a question about your GraphQL schema (e.g., 'How do I create a user?')"
    )
    parser.add_argument(
        "--top_k",
        type=int,
        default=5,
        help="Number of relevant SDL chunks to retrieve"
    )
    parser.add_argument(
        "--model",
        default="llama3",
        help="Name of the Ollama model to use (e.g., llama3, mistral, codellama)"
    )

    args = parser.parse_args()

    agent = LLMQA(model=args.model)
    answer = agent.answer(args.question, top_k=args.top_k)

    print("\nAnswer:\n")
    print(answer)

if __name__ == "__main__":
    main()
