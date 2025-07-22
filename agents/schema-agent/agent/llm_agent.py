from agent.retriever import Retriever
import ollama
import sys
import datetime
import json
import os

DEFAULT_SYSTEM_PROMPT = (
    "You are a GraphQL schema expert.\n\n"
    "Using ONLY the following GraphQL schema context, answer the user's question as accurately as possible.\n"
    "- If the answer is not in the context, say 'I don't know based on the provided schema context.'\n"
    "- Cite the relevant schema chunk(s) by filename if possible.\n"
)

# Example Q&A for few-shot prompting
EXAMPLES = '''
### Example 1
Question: What is the type of the field `ping` in the Query type?
Schema Context:
type Query {
  """Simple query that returns a static value of `pong`"""
  ping: String!
}
Answer: The type of the field `ping` in the Query type is `String!`. (Source: queries_ping.graphql)

### Example 2
Question: How do I create a user?
Schema Context:
# Source: mutation_CreateUser.graphql
mutation {
  createUser(input: CreateUserInput!): User
}
Answer: You can create a user using the `createUser` mutation. (Source: mutation_CreateUser.graphql)
'''

def estimate_tokens(text):
    # Simple proxy: 1 token ≈ 0.75 words
    return int(len(text.split()) / 0.75)

class LLMQA:
    def __init__(self, model="llama3", system_prompt=None, use_examples=True, max_tokens=3500,
                 temperature=0.0, llm_max_tokens=None, index_path="embeddings/index.faiss", metadata_path="embeddings/metadata.json",
                 log_path=None, history_path=None):
        self.retriever = Retriever(index_path=index_path, metadata_path=metadata_path)
        self.model = model
        self.system_prompt = system_prompt or DEFAULT_SYSTEM_PROMPT
        self.use_examples = use_examples
        self.max_tokens = max_tokens
        self.temperature = temperature
        self.llm_max_tokens = llm_max_tokens
        self.log_path = log_path
        self.history_path = history_path
        self.history = self.load_history(history_path) if history_path else []

    def load_history(self, path):
        if not path or not os.path.exists(path):
            return []
        try:
            with open(path, "r") as f:
                return json.load(f)
        except Exception as e:
            print(f"[WARN] Failed to load history from {path}: {e}")
            return []

    def save_history(self):
        if not self.history_path:
            return
        try:
            with open(self.history_path, "w") as f:
                json.dump(self.history, f, indent=2)
        except Exception as e:
            print(f"[WARN] Failed to save history to {self.history_path}: {e}")

    def build_prompt(self, question: str, context: str) -> str:
        prompt = self.system_prompt + "\n"
        if self.use_examples:
            prompt += EXAMPLES + "\n"
        prompt += f"### Question:\n{question}\n\n### Schema Context:\n{context}\n\n### Answer:\n"
        return prompt

    def fit_context_to_token_budget(self, question, chunks, warn=True):
        base_prompt = self.system_prompt + (EXAMPLES + "\n" if self.use_examples else "")
        q_section = f"### Question:\n{question}\n\n"
        a_section = "\n\n### Answer:\n"
        formatted_chunks = [self.retriever.format_context([chunk]) for chunk in chunks]
        context = "\n\n---\n\n".join([c for c in formatted_chunks])
        prompt = base_prompt + q_section + f"### Schema Context:\n{context}" + a_section
        tokens = estimate_tokens(prompt)
        if tokens <= self.max_tokens:
            return context, len(chunks)
        for i in range(len(chunks)-1, 0, -1):
            context = "\n\n---\n\n".join([self.retriever.format_context([chunk]) for chunk in chunks[:i]])
            prompt = base_prompt + q_section + f"### Schema Context:\n{context}" + a_section
            tokens = estimate_tokens(prompt)
            if tokens <= self.max_tokens:
                if warn:
                    print(f"[WARN] Truncated context to top {i} chunks to fit token budget ({self.max_tokens} tokens).")
                return context, i
        if warn:
            print(f"[WARN] No context chunks fit within the token budget ({self.max_tokens} tokens). Returning empty context.")
        return "", 0

    def log(self, question, chunk_paths, prompt, response):
        if not self.log_path:
            return
        with open(self.log_path, "a") as f:
            f.write(f"==== LLMQA LOG {datetime.datetime.now().isoformat()} ====" + "\n")
            f.write(f"Question: {question}\n")
            f.write(f"Retrieved Chunks: {', '.join(chunk_paths)}\n")
            f.write(f"\n--- Prompt ---\n{prompt}\n")
            f.write(f"\n--- LLM Response ---\n{response}\n")
            f.write(f"==== END LOG ====" + "\n\n")

    def build_messages(self, prompt, history=None):
        messages = []
        if history:
            for turn in history:
                if "role" in turn and "content" in turn:
                    messages.append({"role": turn["role"], "content": turn["content"]})
        messages.append({"role": "user", "content": prompt})
        return messages

    def answer(self, question: str, top_k: int = 5) -> str:
        chunks = self.retriever.retrieve_chunks(question, top_k=top_k)
        if not chunks:
            raise RuntimeError("No relevant schema context found for your question.")
        context, used_k = self.fit_context_to_token_budget(question, chunks)
        prompt = self.build_prompt(question, context)
        chunk_paths = [c[0] for c in chunks]
        messages = self.build_messages(prompt, self.history)

        ollama_args = {
            "model": self.model,
            "messages": messages,
        }
        try:
            response = ollama.chat(**ollama_args)
        except Exception as e:
            raise RuntimeError(f"Ollama API call failed: {e}")
        answer = response['message']['content'].strip()
        self.log(question, chunk_paths, prompt, answer)
        # Update history
        if self.history_path is not None:
            self.history.append({"role": "user", "content": prompt})
            self.history.append({"role": "assistant", "content": answer})
            self.save_history()
        return answer

    def stream_answer(self, question: str, top_k: int = 5):
        chunks = self.retriever.retrieve_chunks(question, top_k=top_k)
        if not chunks:
            raise RuntimeError("No relevant schema context found for your question.")
        context, used_k = self.fit_context_to_token_budget(question, chunks)
        prompt = self.build_prompt(question, context)
        chunk_paths = [c[0] for c in chunks]
        messages = self.build_messages(prompt, self.history)

        ollama_args = {
            "model": self.model,
            "messages": messages,
            "stream": True
        }
        try:
            response_accum = ""
            for chunk in ollama.chat(**ollama_args):
                if "message" in chunk and "content" in chunk["message"]:
                    response_accum += chunk["message"]["content"]
                    yield chunk["message"]["content"]
            self.log(question, chunk_paths, prompt, response_accum)
            # Update history
            if self.history_path is not None:
                self.history.append({"role": "user", "content": prompt})
                self.history.append({"role": "assistant", "content": response_accum})
                self.save_history()
        except Exception as e:
            raise RuntimeError(f"Ollama API call failed: {e}")

    def repl(self, top_k=5):
        print("[LLMQA REPL] Type 'exit' or 'quit' to end the session.")
        while True:
            try:
                question = input("\nYou: ").strip()
                if question.lower() in ("exit", "quit"):
                    print("[LLMQA REPL] Session ended.")
                    break
                answer = self.answer(question, top_k=top_k)
                print(f"\nAssistant: {answer}")
            except Exception as e:
                print(f"[ERROR] {e}")

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Ask a question about the GraphQL schema using a local Ollama model.")
    parser.add_argument("--question", help="The question to ask the schema-aware LLM agent. (omit for REPL mode)")
    parser.add_argument("--top_k", type=int, default=5, help="Number of top schema chunks to include in context.")
    parser.add_argument("--model", default="llama3", help="Ollama model to use (e.g., llama3, codellama, mistral)")
    parser.add_argument("--system_prompt", default=None, help="Override the default system prompt.")
    parser.add_argument("--no_examples", action="store_true", help="Do not include Q&A examples in the prompt.")
    parser.add_argument("--max_tokens", type=int, default=3500, help="Maximum tokens for the prompt (approximate, default 3500)")
    parser.add_argument("--temperature", type=float, default=0.0, help="LLM temperature (default 0.0, ignored for Ollama)")
    parser.add_argument("--llm_max_tokens", type=int, default=None, help="Maximum tokens for LLM output (default: model default, ignored for Ollama)")
    parser.add_argument("--index_path", default="embeddings/index.faiss", help="Path to FAISS index file for retrieval")
    parser.add_argument("--metadata_path", default="embeddings/metadata.json", help="Path to metadata JSON file for retrieval")
    parser.add_argument("--log_path", default=None, help="Path to log file for prompt, chunks, and response (plain text)")
    parser.add_argument("--history_path", default=None, help="Path to JSON file for chat history (multi-turn support)")
    parser.add_argument("--repl", action="store_true", help="Start in interactive REPL (multi-turn chat) mode")

    args = parser.parse_args()

    try:
        qa_agent = LLMQA(
            model=args.model,
            system_prompt=args.system_prompt,
            use_examples=not args.no_examples,
            max_tokens=args.max_tokens,
            temperature=args.temperature,
            llm_max_tokens=args.llm_max_tokens,
            index_path=args.index_path,
            metadata_path=args.metadata_path,
            log_path=args.log_path,
            history_path=args.history_path
        )
        if args.repl:
            qa_agent.repl(top_k=args.top_k)
        elif args.question:
            answer = qa_agent.answer(args.question, top_k=args.top_k)
            print("\nAnswer:")
            print(answer)
            if args.log_path:
                print(f"[INFO] Log written to {args.log_path}")
        else:
            print("[ERROR] You must provide --question or use --repl for interactive mode.", file=sys.stderr)
            sys.exit(1)
    except Exception as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        sys.exit(1)
