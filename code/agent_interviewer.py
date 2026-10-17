# 第二版：多工具 + 多轮对话的面试官（get_question + record_score）
import json, os
from openai import OpenAI

client = OpenAI(api_key=os.environ["DEEPSEEK_API_KEY"],
                base_url="https://api.deepseek.com")

QUESTIONS = {
    "工具调用": "请解释 Function Calling 的原理。",
    "规划": "ReAct 和 Plan-and-Execute 有什么区别？",
    "记忆": "Agent 的短期记忆和长期记忆分别怎么实现？",
}
scores = []  # 记录每次评分，相当于一个简单的"数据库"

def get_question(topic: str) -> str:
    return QUESTIONS.get(topic, "题库里没有这个主题")

def record_score(topic: str, score: int, missing: str) -> str:
    scores.append({"topic": topic, "score": score, "missing": missing})
    avg = sum(s["score"] for s in scores) / len(scores)
    return f"已记录。目前共答 {len(scores)} 题，平均分 {avg:.1f}"

TOOL_FUNCS = {"get_question": get_question, "record_score": record_score}

tools = [
    {"type": "function", "function": {
        "name": "get_question",
        "description": "按主题从题库取一道面试题。开始面试或换题时使用。",
        "parameters": {"type": "object",
            "properties": {"topic": {"type": "string", "enum": list(QUESTIONS)}},
            "required": ["topic"]}}},
    {"type": "function", "function": {
        "name": "record_score",
        "description": "候选人回答问题后，给回答打分（1-10）并记录遗漏的要点。",
        "parameters": {"type": "object",
            "properties": {
                "topic": {"type": "string", "enum": list(QUESTIONS)},
                "score": {"type": "integer", "minimum": 1, "maximum": 10},
                "missing": {"type": "string", "description": "回答中遗漏的关键点"}},
            "required": ["topic", "score", "missing"]}}},
]

SYSTEM = """你是严格但友好的 AI Agent 面试官。流程：
1. 用 get_question 取题并提问，一次只问一题。
2. 候选人回答后，先调用 record_score 打分，再简要点评。
3. 分数低于 7 分就针对遗漏点追问一次；否则换一个新主题。"""

messages = [{"role": "system", "content": SYSTEM}]   # 放在函数外 = 跨轮次的短期记忆

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
            name = call.function.name
            args = json.loads(call.function.arguments)
            print(f"  [工具] {name}({args})")
            result = TOOL_FUNCS[name](**args)   # 按名字分发到对应函数
            messages.append({"role": "tool",
                             "tool_call_id": call.id, "content": result})
    return "超过最大步数"

print("面试官：", agent_turn("我准备好了，开始面试吧"))
while True:
    answer = input("\n你：")
    if answer in ("q", "退出"):
        break
    print("\n面试官：", agent_turn(answer))
