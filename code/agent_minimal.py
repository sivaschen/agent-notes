# 第一版：最小 Agent，只有一个 get_question 工具
# 运行前：在 PowerShell 里设置 $env:DEEPSEEK_API_KEY="你的key"（不要把 Key 写进代码）
import json, os
from openai import OpenAI

client = OpenAI(api_key=os.environ["DEEPSEEK_API_KEY"],   # 方括号里是变量名，不是 Key 本身
                base_url="https://api.deepseek.com")

QUESTIONS = {
    "工具调用": "请解释 Function Calling 的原理。",
    "规划": "ReAct 和 Plan-and-Execute 有什么区别？",
    "记忆": "Agent 的短期记忆和长期记忆分别怎么实现？",
}

def get_question(topic: str) -> str:
    return QUESTIONS.get(topic, "题库里没有这个主题")

tools = [{
    "type": "function",
    "function": {
        "name": "get_question",
        "description": "按主题从题库里取一道 Agent 面试题",
        "parameters": {
            "type": "object",
            "properties": {"topic": {"type": "string", "enum": list(QUESTIONS)}},
            "required": ["topic"],
        },
    },
}]

def run_agent(user_input: str) -> str:
    messages = [
        {"role": "system", "content": "你是 Agent 面试官，需要时用工具取题。"},
        {"role": "user", "content": user_input},
    ]
    for step in range(5):                      # 步数上限，防止死循环
        resp = client.chat.completions.create(
            model="deepseek-chat", messages=messages, tools=tools)
        msg = resp.choices[0].message
        messages.append(msg)                   # 先把 assistant 消息本身加进去
        if not msg.tool_calls:                 # 没有工具调用 = 最终回答
            return msg.content
        for call in msg.tool_calls:
            args = json.loads(call.function.arguments)   # arguments 是 JSON 字符串
            print(f"[第{step + 1}步] 调用 {call.function.name}({args})")
            result = get_question(**args)
            messages.append({"role": "tool",
                             "tool_call_id": call.id, "content": result})
    return "超过最大步数"

if __name__ == "__main__":
    print(run_agent("给我出一道关于规划的面试题"))
