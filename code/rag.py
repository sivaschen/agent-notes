# 第三版：最小 RAG（TF-IDF 版），把 JD 资料做成 search_jd 工具交给 Agent
# 依赖：python -m pip install openai scikit-learn
import json, os
from openai import OpenAI
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

client = OpenAI(api_key=os.environ["DEEPSEEK_API_KEY"],
                base_url="https://api.deepseek.com")

# ---------- 第 1 步：切块 ----------
with open("agent_jd_summary.md", encoding="utf-8") as f:
    text = f.read()
chunks = [c.strip() for c in text.split("\n") if len(c.strip()) > 10]
print(f"资料切成了 {len(chunks)} 块")

# ---------- 第 2 步：向量化 ----------
# 按单字和双字切词，中文不需要额外分词库
vectorizer = TfidfVectorizer(analyzer="char", ngram_range=(1, 2))
chunk_vectors = vectorizer.fit_transform(chunks)

# ---------- 第 3 步：检索 ----------
def search_jd(query: str, top_k: int = 5) -> str:
    query_vector = vectorizer.transform([query])
    scores = cosine_similarity(query_vector, chunk_vectors)[0]
    best = scores.argsort()[::-1][:top_k]          # 相似度最高的 k 块
    return "\n".join(chunks[i] for i in best)

# ---------- 第 4 步：把检索做成工具，交给 Agent ----------
tools = [{"type": "function", "function": {
    "name": "search_jd",
    "description": "从收集的 AI Agent 岗位 JD 资料中检索相关内容。"
                   "回答关于招聘要求、技能、岗位的问题时必须使用。",
    "parameters": {"type": "object",
        "properties": {"query": {"type": "string",
                                 "description": "检索关键词或问题"}},
        "required": ["query"]}}}]

messages = [{"role": "system", "content":
    "你是求职顾问。回答前先用 search_jd 检索资料，只根据检索结果回答，"
    "资料里没有的就说不知道，不要编造。"}]

def agent_turn(user_input: str) -> str:
    messages.append({"role": "user", "content": user_input})
    for step in range(5):
        resp = client.chat.completions.create(
            model="deepseek-chat", messages=messages, tools=tools)
        msg = resp.choices[0].message
        messages.append(msg)
        if not msg.tool_calls:
            return msg.content
        for call in msg.tool_calls:
            args = json.loads(call.function.arguments)
            result = search_jd(**args)
            print(f"  [检索] {args['query']}\n  [命中]\n{result}\n")
            messages.append({"role": "tool",
                             "tool_call_id": call.id, "content": result})
    return "超过最大步数"

while True:
    q = input("\n你：")
    if q in ("q", "退出"):
        break
    print("\n顾问：", agent_turn(q))
