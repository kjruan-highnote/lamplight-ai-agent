from src.faiss_retriever import FAISSDocumentRetriever
import ollama
import sys
import datetime
import json
import os

DEFAULT_SYSTEM_PROMPT = (
    "You are a Highnote documentation expert.\n\n"
    "Using ONLY the following Highnote documentation context, answer the user's question as accurately as possible.\n"
    "- If the answer is not in the context, say 'I don't know based on the provided documentation.'\n"
    "- If the question is vague, ask the user to be more specific.\n"
    "- Provide code examples, API references, and step-by-step instructions when available.\n"
    "- Focus on practical implementation guidance.\n"
)

# Example Q&A for few-shot prompting
EXAMPLES = '''
### Example 1
Question: How do I create a card product?
Documentation Context:
# Source 1: issuing_templates_consumer-charge (relevance: 0.85)
To create a card product, you first need to configure your card product settings in the Highnote dashboard...

Answer: To create a card product in Highnote, you need to:
1. Configure your card product settings in the Highnote dashboard
2. Set up your card design and branding
3. Define authorization rules and limits
(Source: issuing_templates_consumer-charge)

### Example 2
Question: What is GraphQL?
Documentation Context:
# Source 1: basics_graphql-api (relevance: 0.90)
Highnote uses GraphQL for its API. GraphQL is a query language that allows you to request exactly the data you need...

Answer: GraphQL is a query language used by Highnote's API that allows you to request exactly the data you need in a single request. This makes it more efficient than traditional REST APIs. (Source: basics_graphql-api)
'''

def estimate_tokens(text):
    """Simple proxy: 1 token ≈ 0.75 words"""
    return int(len(text.split()) / 0.75)

class DocumentLLMAgent:
    def __init__(self, 
                 model="llama3", 
                 system_prompt=None, 
                 use_examples=True, 
                 max_tokens=3500,
                 temperature=0.0, 
                 chunks_dir="data/chunks",
                 log_path=None, 
                 history_path=None):
        self.retriever = FAISSDocumentRetriever(index_path="data/embeddings")
        self.model = model
        self.system_prompt = system_prompt or DEFAULT_SYSTEM_PROMPT
        self.use_examples = use_examples
        self.max_tokens = max_tokens
        self.temperature = temperature
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
        prompt += f"### Question:\n{question}\n\n### Documentation Context:\n{context}\n\n### Answer:\n"
        return prompt

    def fit_context_to_token_budget(self, question, chunks, warn=True):
        base_prompt = self.system_prompt + (EXAMPLES + "\n" if self.use_examples else "")
        q_section = f"### Question:\n{question}\n\n"
        a_section = "\n\n### Answer:\n"
        
        context = self.retriever.format_context(chunks)
        prompt = base_prompt + q_section + f"### Documentation Context:\n{context}" + a_section
        tokens = estimate_tokens(prompt)
        
        if tokens <= self.max_tokens:
            return context, len(chunks)
        
        # Truncate chunks to fit token budget
        for i in range(len(chunks)-1, 0, -1):
            truncated_chunks = chunks[:i]
            context = self.retriever.format_context(truncated_chunks)
            prompt = base_prompt + q_section + f"### Documentation Context:\n{context}" + a_section
            tokens = estimate_tokens(prompt)
            
            if tokens <= self.max_tokens:
                if warn:
                    print(f"[WARN] Truncated context to top {i} chunks to fit token budget ({self.max_tokens} tokens).")
                return context, i
        
        if warn:
            print(f"[WARN] No context chunks fit within the token budget ({self.max_tokens} tokens). Returning empty context.")
        return "", 0

    def log(self, question, chunk_ids, prompt, response):
        if not self.log_path:
            return
        with open(self.log_path, "a") as f:
            f.write(f"==== DOCUMENT AGENT LOG {datetime.datetime.now().isoformat()} ====" + "\n")
            f.write(f"Question: {question}\n")
            f.write(f"Retrieved Chunks: {', '.join(chunk_ids)}\n")
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

    def answer(self, question: str, top_k: int = 5, category_filter: str = None) -> str:
        chunks = self.retriever.retrieve_chunks(question, top_k=top_k)
        
        if not chunks:
            raise RuntimeError("No relevant documentation found for your question.")
        
        context, used_k = self.fit_context_to_token_budget(question, chunks)
        prompt = self.build_prompt(question, context)
        chunk_ids = [chunk_id for chunk_id, _, _ in chunks]
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
        self.log(question, chunk_ids, prompt, answer)
        
        # Update history
        if self.history_path is not None:
            self.history.append({"role": "user", "content": prompt})
            self.history.append({"role": "assistant", "content": answer})
            self.save_history()
        
        return answer

    def stream_answer(self, question: str, top_k: int = 5, category_filter: str = None):
        chunks = self.retriever.retrieve_chunks(question, top_k=top_k)
        
        if not chunks:
            raise RuntimeError("No relevant documentation found for your question.")
        
        context, used_k = self.fit_context_to_token_budget(question, chunks)
        prompt = self.build_prompt(question, context)
        chunk_ids = [chunk_id for chunk_id, _, _ in chunks]
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
            
            self.log(question, chunk_ids, prompt, response_accum)
            
            # Update history
            if self.history_path is not None:
                self.history.append({"role": "user", "content": prompt})
                self.history.append({"role": "assistant", "content": response_accum})
                self.save_history()
        except Exception as e:
            raise RuntimeError(f"Ollama API call failed: {e}")

    def repl(self, top_k=5):
        print("[DOCUMENT AGENT REPL] Type 'exit' or 'quit' to end the session.")
        while True:
            try:
                question = input("\nYou: ").strip()
                if question.lower() in ("exit", "quit"):
                    print("[DOCUMENT AGENT REPL] Session ended.")
                    break
                answer = self.answer(question, top_k=top_k)
                print(f"\nAssistant: {answer}")
            except Exception as e:
                print(f"[ERROR] {e}")

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Ask questions about Highnote documentation using a local Ollama model.")
    parser.add_argument("--question", help="The question to ask (omit for REPL mode)")
    parser.add_argument("--top_k", type=int, default=5, help="Number of top chunks to include in context.")
    parser.add_argument("--model", default="llama3", help="Ollama model to use")
    parser.add_argument("--category", help="Filter by documentation category")
    parser.add_argument("--chunks-dir", default="data/chunks", help="Path to chunks directory")
    parser.add_argument("--repl", action="store_true", help="Start in interactive REPL mode")

    args = parser.parse_args()

    try:
        agent = DocumentLLMAgent(
            model=args.model,
            chunks_dir=args.chunks_dir
        )
        
        if args.repl:
            agent.repl(top_k=args.top_k)
        elif args.question:
            answer = agent.answer(args.question, top_k=args.top_k, category_filter=args.category)
            print("\nAnswer:")
            print(answer)
        else:
            print("[ERROR] You must provide --question or use --repl for interactive mode.", file=sys.stderr)
            sys.exit(1)
    except Exception as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        sys.exit(1)