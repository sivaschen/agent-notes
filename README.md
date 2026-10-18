# AI Agent 面试复习笔记

在线阅读：https://sivaschen.github.io/agent-notes/

纯静态网页，无外部依赖（原生 JS / CSS / SVG）：

- Agent 循环 / Function Calling 逐步演示（messages 列表逐条增长，展示真实 JSON）
- 浏览器内运行的 RAG 检索演示（字符 1-2gram TF-IDF + 余弦相似度，与 sklearn 结果一致）
- 每章面试卡片（翻面、标记会/不会）和小测验（即时反馈与解析），进度存在 localStorage
- 学习进度面板、SVG 图解、章节折叠、代码复制与高亮、搜索、目录、深浅色、手机适配

文件：index.html、style.css、app.js、widgets.js、tfidf.js、data.js（测验题库）、rag-corpus.js（由 agent_jd_summary.md 生成）

- `code/`：练习脚本（最小 Agent、面试官 Agent、TF-IDF 版 RAG）。运行前设置环境变量 `DEEPSEEK_API_KEY`，不要把 Key 写进代码。
- `agent_jd_summary.md`：24 份公开 JD 的技能汇总。
