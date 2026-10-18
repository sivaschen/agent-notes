/* 交互组件：Agent 循环演示、RAG 检索演示、面试卡片、小测验、进度面板、折叠、代码复制与高亮。纯原生 JS，无依赖。 */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (k === "class") e.className = attrs[k]; else e.setAttribute(k, attrs[k]); });
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  function emit() { document.dispatchEvent(new CustomEvent("progress")); }
  window.AN = { $: $, $$: $$, el: el, esc: esc, store: store };

  /* ---------- 代码高亮（Python / JSON 通用的轻量版） ---------- */
  var KW = /^(def|return|for|in|if|elif|else|not|and|or|import|from|while|break|continue|with|as|lambda|class|try|except|raise|pass|True|False|None|null|true|false)$/;
  function highlight(code) {
    var re = /(#[^\n]*|\/\/[^\n]*)|("""[\s\S]*?"""|[fr]?"(?:\\.|[^"\\\n])*"|[fr]?'(?:\\.|[^'\\\n])*')|\b([A-Za-z_]\w*)\b|\b(\d+(?:\.\d+)?)\b/g;
    var out = "", last = 0, m;
    while ((m = re.exec(code))) {
      out += esc(code.slice(last, m.index)); last = re.lastIndex;
      if (m[1]) out += '<span class="tk-c">' + esc(m[1]) + "</span>";
      else if (m[2]) out += '<span class="tk-s">' + esc(m[2]) + "</span>";
      else if (m[3]) {
        var w = m[3], next = code.charAt(re.lastIndex);
        if (KW.test(w)) out += '<span class="tk-k">' + w + "</span>";
        else if (next === "(") out += '<span class="tk-f">' + w + "</span>";
        else out += w;
      } else out += '<span class="tk-n">' + m[4] + "</span>";
    }
    return out + esc(code.slice(last));
  }
  window.AN.highlight = highlight;

  function enhanceCode(root) {
    $$("pre", root).forEach(function (pre) {
      if (pre.parentNode.classList.contains("codewrap")) return;
      var code = pre.querySelector("code") || pre;
      code.innerHTML = highlight(code.textContent);
      var wrap = el("div", { class: "codewrap" });
      pre.parentNode.insertBefore(wrap, pre); wrap.appendChild(pre);
      var btn = el("button", { class: "copy", type: "button", "aria-label": "复制代码" }, "复制");
      btn.onclick = function () {
        var txt = code.textContent;
        var done = function () { btn.textContent = "已复制 ✓"; btn.classList.add("ok"); setTimeout(function () { btn.textContent = "复制"; btn.classList.remove("ok"); }, 1500); };
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(done, fallback); else fallback();
        function fallback() { var t = el("textarea"); t.value = txt; t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); done(); } catch (e) { btn.textContent = "请手动复制"; } t.remove(); }
      };
      wrap.appendChild(btn);
    });
  }

  /* ---------- 章节折叠 ---------- */
  var COLL = "an-collapsed";
  function setupCollapse() {
    var collapsed = store.get(COLL, []);
    $$("section.topic").forEach(function (s) {
      var h2 = s.querySelector("h2"), body = el("div", { class: "sec-body" });
      while (h2.nextSibling) body.appendChild(h2.nextSibling);
      s.appendChild(body);
      var t = el("button", { class: "sec-toggle", type: "button", "aria-expanded": "true", "aria-label": "折叠/展开本章" }, "<span>▾</span>");
      h2.classList.add("sec-h"); h2.appendChild(t);
      var badge = el("span", { class: "sec-badge", "data-ch": s.id }); h2.appendChild(badge);
      h2.addEventListener("click", function (e) { if (e.target.closest("a")) return; toggle(s); });
      if (collapsed.indexOf(s.id) > -1) toggle(s, true);
    });
  }
  function toggle(s, force) {
    var c = force != null ? force : !s.classList.contains("collapsed");
    s.classList.toggle("collapsed", c);
    var b = s.querySelector(".sec-toggle"); if (b) b.setAttribute("aria-expanded", String(!c));
    var list = $$("section.topic.collapsed").map(function (x) { return x.id; });
    store.set(COLL, list);
  }
  window.AN.expand = function (s) { if (s && s.classList.contains("collapsed")) toggle(s, false); };
  window.AN.setAll = function (c) { $$("section.topic").forEach(function (s) { toggle(s, c); }); };
  function revealTarget(id) {
    var t = id && document.getElementById(id); if (!t) return;
    var s = t.closest("section.topic"); if (s) window.AN.expand(s);
  }
  window.addEventListener("hashchange", function () { revealTarget(location.hash.slice(1)); });
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#"]'); if (a) revealTarget(a.getAttribute("href").slice(1));
  });

  /* ---------- 面试卡片 ---------- */
  var CARDS = "an-cards";
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  function setupDecks() {
    $$(".deck").forEach(function (deck) {
      var ch = deck.getAttribute("data-ch"), items = [];
      [].slice.call(deck.children).forEach(function (c) {
        if (c.classList.contains("answer")) {
          var b = c.querySelector("b"), q = b.innerHTML.replace(/^问：/, ""); b.remove();
          var a = c.innerHTML.replace(/^\s*<br\s*\/?>/i, "");
          items.push({ q: q, a: a, kind: "面试题" });
        } else if (c.tagName === "DETAILS") {
          var sm = c.querySelector("summary"), q2 = sm.innerHTML; sm.remove();
          items.push({ q: q2, a: c.innerHTML, kind: "追问" });
        }
      });
      deck.innerHTML = "";
      items.forEach(function (it) { it.id = ch + ":" + hash(it.q.replace(/<[^>]+>/g, "")); });
      deck._items = items;
      buildDeck(deck, ch, items);
    });
  }
  function buildDeck(deck, ch, items) {
    var state = store.get(CARDS, {});
    var bar = el("div", { class: "deck-bar" });
    var stat = el("span", { class: "deck-stat" });
    var modeBtn = el("button", { class: "btn sm", type: "button" }, "列表模式");
    var weakBtn = el("button", { class: "btn sm", type: "button", "aria-pressed": "false" }, "只看不会");
    var shufBtn = el("button", { class: "btn sm", type: "button" }, "打乱");
    bar.appendChild(stat); var g = el("span", { class: "deck-tools" }); g.appendChild(weakBtn); g.appendChild(shufBtn); g.appendChild(modeBtn); bar.appendChild(g);
    var stage = el("div", { class: "deck-stage" });
    var nav = el("div", { class: "deck-nav" });
    var prev = el("button", { class: "btn", type: "button", "aria-label": "上一张" }, "‹ 上一张");
    var pos = el("span", { class: "deck-pos" });
    var next = el("button", { class: "btn", type: "button", "aria-label": "下一张" }, "下一张 ›");
    var no = el("button", { class: "btn mark-no", type: "button" }, "✗ 不会");
    var yes = el("button", { class: "btn mark-yes", type: "button" }, "✓ 会");
    nav.appendChild(prev); nav.appendChild(no); nav.appendChild(pos); nav.appendChild(yes); nav.appendChild(next);
    deck.appendChild(bar); deck.appendChild(stage); deck.appendChild(nav);
    var cards = items.map(function (it, i) {
      var c = el("div", { class: "fcard", tabindex: "0", role: "button", "aria-label": "翻面", "data-id": it.id });
      c.innerHTML = '<div class="fc-inner"><div class="fc-face fc-front"><span class="fc-kind">' + it.kind + '</span><span class="fc-state"></span><div class="fc-q">' + it.q + '</div><div class="fc-tip">点击翻面 ↻</div></div><div class="fc-face fc-back"><span class="fc-kind">参考答案</span><div class="fc-q small">' + it.q + '</div><div class="fc-a">' + it.a + "</div></div></div>";
      c.addEventListener("click", function (e) { if (deck.classList.contains("list") || e.target.closest("a")) return; c.classList.toggle("flipped"); });
      c.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); c.click(); } });
      stage.appendChild(c); return c;
    });
    var order = items.map(function (_, i) { return i; }), cur = 0, weakOnly = false;
    function visible() { return order.filter(function (i) { return !weakOnly || state[items[i].id] !== 1; }); }
    function render() {
      state = store.get(CARDS, {});
      var vis = visible(); if (cur >= vis.length) cur = Math.max(0, vis.length - 1);
      var known = items.filter(function (it) { return state[it.id] === 1; }).length;
      var unk = items.filter(function (it) { return state[it.id] === 0; }).length;
      stat.innerHTML = "共 " + items.length + " 张 · <b class='ok'>会 " + known + "</b> · <b class='bad'>不会 " + unk + "</b> · 未标记 " + (items.length - known - unk);
      cards.forEach(function (c, i) {
        var st = state[items[i].id];
        c.classList.toggle("known", st === 1); c.classList.toggle("unknown", st === 0);
        c.querySelector(".fc-state").textContent = st === 1 ? "✓ 会" : st === 0 ? "✗ 不会" : "";
        c.classList.toggle("active", vis[cur] === i);
        c.style.order = order.indexOf(i);
      });
      pos.textContent = vis.length ? (cur + 1) + " / " + vis.length : "全部掌握 🎉";
      stage.classList.toggle("empty", !vis.length);
      prev.disabled = cur <= 0; next.disabled = cur >= vis.length - 1;
      yes.disabled = no.disabled = !vis.length;
    }
    function mark(v) {
      var vis = visible(); if (!vis.length) return;
      var it = items[vis[cur]]; state = store.get(CARDS, {}); state[it.id] = v; store.set(CARDS, state);
      cards[vis[cur]].classList.remove("flipped");
      if (!weakOnly || v === 0) { if (cur < visible().length - 1) cur++; }
      render(); emit();
    }
    prev.onclick = function () { cards.forEach(function (c) { c.classList.remove("flipped"); }); cur--; render(); };
    next.onclick = function () { cards.forEach(function (c) { c.classList.remove("flipped"); }); cur++; render(); };
    yes.onclick = function () { mark(1); }; no.onclick = function () { mark(0); };
    modeBtn.onclick = function () { var l = deck.classList.toggle("list"); modeBtn.textContent = l ? "卡片模式" : "列表模式"; };
    weakBtn.onclick = function () { weakOnly = !weakOnly; weakBtn.setAttribute("aria-pressed", String(weakOnly)); weakBtn.classList.toggle("on", weakOnly); cur = 0; render(); };
    shufBtn.onclick = function () { for (var i = order.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = order[i]; order[i] = order[j]; order[j] = t; } cur = 0; render(); };
    deck._render = render; deck._showCard = function (i) { var v = visible(), k = v.indexOf(i); if (k > -1) { cur = k; render(); } };
    document.addEventListener("progress", render);
    render();
  }

  /* ---------- 小测验 ---------- */
  var QZ = "an-quiz";
  function setupQuizzes() {
    $$(".quiz").forEach(function (box) {
      var ch = box.getAttribute("data-ch"), qs = (window.QUIZ || {})[ch] || [];
      if (!qs.length) { box.innerHTML = '<p class="muted">本章测验题待补充。</p>'; return; }
      box._qs = qs;
      function render() {
        var all = store.get(QZ, {}), st = all[ch] || { ans: {}, best: 0 };
        box.innerHTML = "";
        qs.forEach(function (q, i) {
          var item = el("div", { class: "qz-item" }), chosen = st.ans[i];
          item.appendChild(el("div", { class: "qz-q" }, "<span class='qz-n'>" + (i + 1) + "</span>" + esc(q.q)));
          var opts = el("div", { class: "qz-opts" });
          q.o.forEach(function (o, j) {
            var b = el("button", { class: "qz-opt", type: "button" }, "<span class='qz-l'>" + "ABCD"[j] + "</span>" + esc(o));
            if (chosen != null) {
              b.disabled = true;
              if (j === q.a) b.classList.add("right");
              if (j === chosen && j !== q.a) b.classList.add("wrong");
            }
            b.onclick = function () {
              var a2 = store.get(QZ, {}); var s2 = a2[ch] || { ans: {}, best: 0 }; s2.ans[i] = j;
              var n = Object.keys(s2.ans).length;
              if (n === qs.length) { var c = qs.filter(function (qq, k) { return s2.ans[k] === qq.a; }).length; s2.best = Math.max(s2.best || 0, c); s2.last = c; }
              a2[ch] = s2; store.set(QZ, a2); render(); emit();
            };
            opts.appendChild(b);
          });
          item.appendChild(opts);
          if (chosen != null) item.appendChild(el("div", { class: "qz-exp " + (chosen === q.a ? "ok" : "bad") }, (chosen === q.a ? "✓ 回答正确。" : "✗ 正确答案是 " + "ABCD"[q.a] + "。") + esc(q.e)));
          box.appendChild(item);
        });
        var answered = Object.keys(st.ans).length, correct = qs.filter(function (q, k) { return st.ans[k] === q.a; }).length;
        var foot = el("div", { class: "qz-foot" });
        foot.innerHTML = "<span>已答 " + answered + " / " + qs.length + " · 答对 <b>" + correct + "</b>" + (st.best ? " · 最高分 " + st.best + " / " + qs.length : "") + "</span>";
        if (answered === qs.length) foot.insertAdjacentHTML("afterbegin", "<span class='qz-result'>" + (correct === qs.length ? "🎉 全对！" : correct >= qs.length * 0.6 ? "👍 不错，看看错题解析" : "📖 建议回看本章再试一次") + "</span>");
        var redo = el("button", { class: "btn sm", type: "button" }, "重做");
        redo.onclick = function () { var a2 = store.get(QZ, {}); if (a2[ch]) { a2[ch].ans = {}; store.set(QZ, a2); } render(); emit(); };
        foot.appendChild(redo); box.appendChild(foot);
      }
      box._render = render; render();
    });
  }

  /* ---------- 进度面板 ---------- */
  function chapterStats() {
    var cs = store.get(CARDS, {}), qz = store.get(QZ, {});
    return $$("section.topic").map(function (s) {
      var deck = s.querySelector(".deck"), items = (deck && deck._items) || [];
      var known = items.filter(function (it) { return cs[it.id] === 1; }).length;
      var qs = (window.QUIZ || {})[s.id] || [], best = (qz[s.id] && qz[s.id].best) || 0;
      var parts = [], m = 0;
      if (items.length) parts.push(known / items.length);
      if (qs.length) parts.push(best / qs.length);
      if (parts.length) m = parts.reduce(function (a, b) { return a + b; }, 0) / parts.length;
      return { id: s.id, title: s.querySelector("h2").firstChild.textContent.trim(), cards: items.length, known: known, qn: qs.length, best: best, m: m };
    });
  }
  function ring(p) {
    var r = 46, c = 2 * Math.PI * r;
    return '<svg class="ring" viewBox="0 0 120 120" role="img" aria-label="总掌握度 ' + Math.round(p * 100) + '%"><circle cx="60" cy="60" r="' + r + '" class="ring-bg"/><circle cx="60" cy="60" r="' + r + '" class="ring-fg" stroke-dasharray="' + (c * p).toFixed(1) + " " + c.toFixed(1) + '" transform="rotate(-90 60 60)"/><text x="60" y="58" class="ring-t">' + Math.round(p * 100) + '%</text><text x="60" y="78" class="ring-s">总掌握度</text></svg>';
  }
  function renderDash() {
    var st = chapterStats(), body = $("#dashBody"); if (!body) return;
    var tc = 0, tk = 0, tq = 0, tb = 0;
    body.innerHTML = st.map(function (c) {
      tc += c.cards; tk += c.known; tq += c.qn; tb += c.best;
      var pct = Math.round(c.m * 100), lvl = pct >= 80 ? "hi" : pct >= 40 ? "mid" : "lo";
      return '<a class="dash-item ' + lvl + '" href="#' + c.id + '"><span class="di-t">' + esc(c.title) + '</span><span class="di-bar"><i style="width:' + pct + '%"></i></span><span class="di-n">' + pct + '%</span><span class="di-s">卡片 ' + c.known + "/" + c.cards + " · 测验 " + c.best + "/" + c.qn + "</span></a>";
    }).join("");
    var all = st.filter(function (c) { return c.cards || c.qn; });
    var avg = all.length ? all.reduce(function (a, c) { return a + c.m; }, 0) / all.length : 0;
    $("#dashRing").innerHTML = ring(avg) + '<div class="ring-meta">卡片 ' + tk + " / " + tc + "<br>测验 " + tb + " / " + tq + "</div>";
    $$(".sec-badge").forEach(function (b) {
      var c = st.filter(function (x) { return x.id === b.getAttribute("data-ch"); })[0];
      if (c && (c.cards || c.qn)) { var p = Math.round(c.m * 100); b.textContent = p + "%"; b.className = "sec-badge " + (p >= 80 ? "hi" : p >= 40 ? "mid" : "lo"); }
    });
    var hs = $("#heroStats");
    if (hs) hs.innerHTML = "<span><b>" + st.length + "</b> 章</span><span><b>" + tc + "</b> 张面试卡片</span><span><b>" + tq + "</b> 道测验题</span><span><b>" + $$(".diagram").length + "</b> 张图解</span><span><b>2</b> 个交互演示</span>";
  }

  /* ---------- Agent 循环 / Function Calling 演示 ---------- */
  var SYS = { role: "system", content: "你是 Agent 面试官，需要时用工具取题。" };
  var USER = { role: "user", content: "给我出一道关于规划的面试题" };
  var TOOLS = [{ type: "function", "function": { name: "get_question", description: "按主题从题库里取一道 Agent 面试题", parameters: { type: "object", properties: { topic: { type: "string", "enum": ["工具调用", "规划", "记忆"] } }, required: ["topic"] } } }];
  var A1 = { role: "assistant", content: "I'll fetch a planning-related interview question for you.", tool_calls: [{ id: "call_00_vmzx7cpZ4bUfg5b0gOzn1820", type: "function", "function": { name: "get_question", arguments: "{\"topic\": \"规划\"}" } }] };
  var TOOLMSG = { role: "tool", tool_call_id: "call_00_vmzx7cpZ4bUfg5b0gOzn1820", content: "ReAct 和 Plan-and-Execute 有什么区别？" };
  var A2 = { role: "assistant", content: "这是一道关于**规划**的面试题：\n\n> **ReAct 和 Plan-and-Execute 有什么区别？**\n\n你可以先思考一下……", tool_calls: null };
  var STEPS = [
    { t: "准备对话", who: "code", edge: "u-c", add: [SYS, USER], d: "用户输入一句话。程序把 <b>system 设定</b>和<b>用户消息</b>放进 <code>messages</code> 列表。此时还没调用模型。", code: 'messages = [{"role": "system", ...}, {"role": "user", ...}]' },
    { t: "第 1 次请求模型", who: "model", edge: "c-m", d: "把 <b>messages + tools 说明书</b>一起发给模型。模型看到 tools 的 JSON Schema，才知道有 <code>get_question</code> 可用。右侧「本步数据」就是这次请求里的 tools。", code: 'resp = client.chat.completions.create(model="deepseek-chat", messages=messages, tools=tools)', data: { label: "请求里的 tools", v: TOOLS } },
    { t: "模型返回 tool_calls", who: "code", edge: "m-c", add: [A1], d: "模型决定调用工具，返回 <code>tool_calls</code>。注意：<b>arguments 是 JSON 字符串</b>；<b>content 和 tool_calls 同时有值</b>。程序先把这条 assistant 消息<b>本身</b>加入 messages。", code: "msg = resp.choices[0].message\nmessages.append(msg)" },
    { t: "解析参数并执行工具", who: "tool", edge: "c-t", d: "<code>msg.tool_calls</code> 不为空 → <code>json.loads</code> 把字符串变成字典 → 按名字找到函数并执行。<b>执行发生在模型外面。</b>", code: "args = json.loads(call.function.arguments)   # {'topic': '规划'}\nresult = TOOL_FUNCS[call.function.name](**args)", data: { label: "json.loads 之后的 args", v: { topic: "规划" } } },
    { t: "回传工具结果", who: "code", edge: "t-c", add: [TOOLMSG], d: "工具返回题目。程序追加一条 <code>role: \"tool\"</code> 的消息，<code>tool_call_id</code> 必须和上一步的 <code>id</code> 一致。", code: 'messages.append({"role": "tool", "tool_call_id": call.id, "content": result})' },
    { t: "第 2 次请求模型", who: "model", edge: "c-m", d: "回到循环开头，带着 <b>4 条消息</b>再请求一次。模型现在能看到工具结果了。", code: "for step in range(5):   # 第 2 轮\n    resp = client.chat.completions.create(...)" },
    { t: "模型给出最终回答", who: "code", edge: "m-c", add: [A2], d: "这次 <code>tool_calls</code> 是 <code>null</code>：模型认为可以直接回答了。", code: "msg = resp.choices[0].message\nmessages.append(msg)" },
    { t: "循环结束，返回用户", who: "user", edge: "c-u", d: "<code>if not msg.tool_calls: return msg.content</code>。整个过程请求了模型 <b>2 次</b>，messages 共 <b>5 条</b>。如果模型一直要调工具，<code>range(5)</code> 会兜底防止死循环。", code: "if not msg.tool_calls:\n    return msg.content" }
  ];
  function jsonHTML(o) {
    var s = JSON.stringify(o, null, 2);
    return esc(s).replace(/"((?:\\.|[^"\\])*)"(\s*:)/g, function (_, k, c) { var cls = /^(tool_calls|tool_call_id|role|arguments|id)$/.test(k) ? "tk-key hot" : "tk-key"; return '<span class="' + cls + '">"' + k + '"</span>' + c; })
      .replace(/:\s"((?:\\.|[^"\\])*)"/g, function (_, v) { return ': <span class="tk-s">"' + v + '"</span>'; })
      .replace(/\bnull\b/g, '<span class="tk-k">null</span>');
  }
  function loopDiagram() {
    return '<svg class="diagram loop-svg" viewBox="0 0 400 250" role="img" aria-label="用户、程序、模型、工具之间的数据流">' +
      '<g class="ln" data-n="user"><rect class="nd io" x="6" y="100" width="76" height="46" rx="23"/><text class="lbl b" x="44" y="128">用户</text></g>' +
      '<g class="ln" data-n="code"><rect class="nd main" x="140" y="94" width="110" height="58" rx="12"/><text class="lbl b" x="195" y="118">Agent 程序</text><text class="lbl s" x="195" y="136">messages / 循环</text></g>' +
      '<g class="ln" data-n="model"><rect class="nd" x="290" y="10" width="104" height="54" rx="12"/><text class="lbl b" x="342" y="34">大模型</text><text class="lbl s" x="342" y="51">只生成文字</text></g>' +
      '<g class="ln" data-n="tool"><rect class="nd alt" x="290" y="184" width="104" height="54" rx="12"/><text class="lbl b" x="342" y="207">工具函数</text><text class="lbl s" x="342" y="224">get_question</text></g>' +
      '<path class="ar le" data-e="u-c" d="M82 116 L138 116"/><path class="ar le" data-e="c-u" d="M138 132 L84 132"/>' +
      '<path class="ar le" data-e="c-m" d="M232 92 L292 50"/><path class="ar le" data-e="m-c" d="M300 66 L248 104"/>' +
      '<path class="ar le" data-e="c-t" d="M232 154 L292 196"/><path class="ar le" data-e="t-c" d="M300 182 L248 144"/>' +
      '<text class="lbl s" x="238" y="62">请求</text><text class="lbl s" x="300" y="94">tool_calls / 回答</text><text class="lbl s" x="238" y="196">执行</text><text class="lbl s" x="300" y="160">结果</text>' +
      "</svg>";
  }
  function setupLoopDemo() {
    var box = $("#loopDemo"); if (!box) return;
    box.innerHTML = '<div class="ld-grid"><div class="ld-left">' + loopDiagram() +
      '<div class="ld-step"><div class="ld-title"></div><div class="ld-desc"></div><div class="codewrap"><pre class="ld-code"><code></code></pre></div><div class="ld-data"></div></div></div>' +
      '<div class="ld-right"><div class="ld-head"><span><b>messages</b> 列表</span><span class="ld-count"></span></div><div class="ld-msgs" aria-live="polite"></div></div></div>' +
      '<div class="ld-ctrl"><button class="btn" data-a="prev" type="button">‹ 上一步</button><div class="ld-dots"></div><button class="btn primary" data-a="next" type="button">下一步 ›</button><button class="btn" data-a="play" type="button">▶ 自动播放</button><button class="btn" data-a="reset" type="button">↺ 重置</button></div>';
    var dots = $(".ld-dots", box);
    STEPS.forEach(function (_, i) { var d = el("button", { class: "ld-dot", type: "button", "aria-label": "第 " + (i + 1) + " 步" }); d.onclick = function () { go(i); }; dots.appendChild(d); });
    var cur = -1, timer = null;
    function go(i) {
      cur = Math.max(-1, Math.min(STEPS.length - 1, i));
      var msgs = [], calls = 0;
      for (var k = 0; k <= cur; k++) { if (STEPS[k].add) msgs = msgs.concat(STEPS[k].add.map(function (m) { return { m: m, at: k }; })); if (STEPS[k].edge === "c-m") calls++; }
      var list = $(".ld-msgs", box);
      list.innerHTML = msgs.length ? msgs.map(function (x, n) {
        var r = x.m.role, extra = r === "assistant" ? (x.m.tool_calls ? "带 tool_calls" : "最终回答") : "";
        return '<div class="ld-msg r-' + r + (x.at === cur ? " new" : "") + '"><div class="ld-mh"><span class="ld-idx">[' + n + ']</span><span class="role">' + r + "</span>" + (extra ? '<span class="ld-extra">' + extra + "</span>" : "") + '</div><pre><code>' + jsonHTML(x.m) + "</code></pre></div>";
      }).join("") : '<p class="muted ld-empty">点「下一步」开始。messages 目前是空的。</p>';
      var nm = list.querySelectorAll(".new"); nm = nm[nm.length - 1]; if (nm && list.scrollHeight > list.clientHeight) list.scrollTop += nm.getBoundingClientRect().top - list.getBoundingClientRect().top - 8;
      $(".ld-count", box).textContent = "共 " + msgs.length + " 条 · 已请求模型 " + calls + " 次";
      var s = STEPS[cur];
      $(".ld-title", box).innerHTML = s ? "<span class='ld-no'>第 " + (cur + 1) + " / " + STEPS.length + " 步</span>" + s.t : "<span class='ld-no'>准备</span>Function Calling 一次完整的来回";
      $(".ld-desc", box).innerHTML = s ? s.d : "下面会一步步演示：程序和模型怎么配合，<code>messages</code> 怎么一条条变长。每步都展示真实结构的 JSON（来自之前实际运行 agent.py 的输出）。";
      $(".ld-code code", box).innerHTML = highlight(s ? s.code : "# 点击「下一步」开始");
      $(".ld-data", box).innerHTML = s && s.data ? "<div class='ld-dl'>本步数据：" + s.data.label + "</div><pre><code>" + jsonHTML(s.data.v) + "</code></pre>" : "";
      $$(".le", box).forEach(function (p) { p.classList.toggle("on", !!s && p.getAttribute("data-e") === s.edge); });
      $$(".ln", box).forEach(function (g) { g.classList.toggle("on", !!s && g.getAttribute("data-n") === s.who); });
      $$(".ld-dot", box).forEach(function (d, k) { d.classList.toggle("done", k < cur); d.classList.toggle("cur", k === cur); });
      $('[data-a="prev"]', box).disabled = cur < 0;
      $('[data-a="next"]', box).disabled = cur >= STEPS.length - 1;
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; $('[data-a="play"]', box).textContent = "▶ 自动播放"; } }
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-a]"); if (!b) return; var a = b.getAttribute("data-a");
      if (a === "next") { stop(); go(cur + 1); } else if (a === "prev") { stop(); go(cur - 1); }
      else if (a === "reset") { stop(); go(-1); }
      else if (a === "play") {
        if (timer) return stop();
        if (cur >= STEPS.length - 1) go(-1);
        b.textContent = "⏸ 暂停"; go(cur + 1);
        timer = setInterval(function () { if (cur >= STEPS.length - 1) return stop(); go(cur + 1); }, 2600);
      }
    });
    box._go = go; go(-1);
  }

  /* ---------- RAG 检索演示 ---------- */
  function notesCorpus() {
    var seen = {}, out = [];
    $$("section.topic li, section.topic .sec-body > p, section.topic td").forEach(function (n) {
      if (n.closest(".widget, .deck, .quiz, figure")) return;
      var t = n.textContent.replace(/\s+/g, " ").trim();
      if (t.length > 10 && t.length < 400 && !seen[t]) { seen[t] = 1; out.push(t); }
    });
    return out;
  }
  function setupRagDemo() {
    var box = $("#ragDemo"); if (!box || !window.TfidfIndex) return;
    var JD = window.RAG_CORPUS || [];
    box.innerHTML =
      '<div class="rd-top"><label>资料库 <select class="rd-corpus"><option value="jd">JD 资料（rag.py 同款切块，' + JD.length + ' 块）</option><option value="notes">本站笔记</option><option value="custom">自定义（每行一块）</option></select></label>' +
      '<label>top_k <select class="rd-k"><option>3</option><option selected>5</option><option>10</option></select></label></div>' +
      '<textarea class="rd-custom" rows="5" hidden placeholder="每行一块资料，例如：\nLangGraph 用状态图编排 Agent\nFastAPI 是 Python 的 Web 框架"></textarea>' +
      '<div class="rd-q"><input class="rd-input" type="search" placeholder="输入问题，如：全栈岗对前端有什么要求" value="MCP 在 JD 里出现了多少次"><button class="btn primary rd-go" type="button">检索</button></div>' +
      '<div class="rd-chips">试试：<button type="button">全栈岗对前端有什么要求</button><button type="button">向量数据库</button><button type="button">FastAPI Docker</button><button type="button">需要会哪些编排工具</button></div>' +
      '<div class="rd-stats"></div><div class="rd-feat"></div><ol class="rd-res"></ol>' +
      '<details class="rd-explain"><summary>这个演示和 rag.py 的对应关系</summary><ol><li><b>切块</b>：资料按行切开，丢掉 10 个字以内的行 → <code>chunks</code>。</li><li><b>向量化</b>：<code>TfidfVectorizer(analyzer="char", ngram_range=(1, 2))</code> 统计单字和双字，词频 × idf，再 L2 归一化。浏览器里的实现和 sklearn 默认参数一致（idf = ln((1+n)/(1+df)) + 1），已用 sklearn 逐分数核对过。</li><li><b>检索</b>：问题用同一套词表向量化，和每块算余弦相似度（归一化后就是点积），<code>argsort()[::-1][:top_k]</code>。</li><li><b>生成</b>：真实 Agent 会把下面这些块拼成 tool 消息交给模型，由模型基于资料作答。这一步需要调 API，演示里只展示会发什么。</li></ol><p>试试「需要会哪些编排工具」：资料里写的是 LangGraph，但字面不重合，TF-IDF 分数很低，这就是它不懂语义的局限。</p></details>' +
      '<details class="rd-toolmsg"><summary>将作为 tool 消息发给模型的内容</summary><pre><code></code></pre></details>';
    var cache = {};
    function index() {
      var c = $(".rd-corpus", box).value, docs;
      if (c === "jd") docs = JD; else if (c === "notes") docs = cache.notesDocs || (cache.notesDocs = notesCorpus());
      else docs = $(".rd-custom", box).value.split("\n").map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; });
      var key = c + ":" + (c === "custom" ? docs.join("\n") : "");
      if (!cache[key]) { var t0 = performance.now(); cache[key] = { ix: new TfidfIndex(docs, 1, 2), ms: performance.now() - t0 }; }
      return cache[key];
    }
    function run() {
      var q = $(".rd-input", box).value.trim(), k = +$(".rd-k", box).value, res = $(".rd-res", box);
      var c = index(), ix = c.ix;
      if (!ix.docs.length) { res.innerHTML = ""; $(".rd-stats", box).textContent = "资料库是空的，先在上面输入几行资料。"; $(".rd-feat", box).innerHTML = ""; return; }
      if (!q) { res.innerHTML = ""; $(".rd-feat", box).innerHTML = ""; $(".rd-stats", box).textContent = "输入一个问题试试。"; return; }
      var t0 = performance.now(), r = ix.search(q, k), ms = performance.now() - t0;
      var grams = Array.from(new Set(window.charNgrams(q, 1, 2))).filter(function (g) { return g.trim(); });
      var feats = grams.map(function (g) { return { g: g, w: r.query.get(g) || 0 }; }).sort(function (a, b) { return b.w - a.w; });
      $(".rd-stats", box).innerHTML = "资料 <b>" + ix.docs.length + "</b> 块 · 词表 <b>" + ix.vocabSize() + "</b> 个特征（单字 + 双字）· 建索引 " + c.ms.toFixed(1) + " ms · 检索 " + ms.toFixed(1) + " ms";
      $(".rd-feat", box).innerHTML = "<span class='muted'>问题的特征（权重越大越重要，灰色＝词表里没有、被忽略）：</span>" + feats.slice(0, 24).map(function (f) { return '<span class="feat' + (f.w ? "" : " miss") + '" title="归一化权重 ' + f.w.toFixed(3) + '">' + esc(f.g === " " ? "␣" : f.g) + (f.w ? "<i>" + f.w.toFixed(2) + "</i>" : "") + "</span>"; }).join("") + (feats.length > 24 ? " …" : "");
      var hit = {}; feats.forEach(function (f) { if (f.w && Array.from(f.g).length === 2) hit[f.g.toLowerCase()] = 1; });
      var max = r.top.length ? r.top[0].score || 1 : 1;
      res.innerHTML = r.top.map(function (t, n) {
        var cs = Array.from(t.text), mark = new Array(cs.length);
        for (var i = 0; i + 1 < cs.length; i++) if (hit[(cs[i] + cs[i + 1]).toLowerCase()]) mark[i] = mark[i + 1] = 1;
        var h = cs.map(function (ch, i) { return mark[i] ? "<mark class='hl'>" + esc(ch) + "</mark>" : esc(ch); }).join("").replace(/<\/mark><mark class='hl'>/g, "");
        return '<li class="' + (t.score < 0.05 ? "low" : "") + '"><div class="rd-sc"><span class="rd-rank">#' + (n + 1) + '</span><span class="rd-bar"><i style="width:' + (t.score / max * 100).toFixed(1) + '%"></i></span><b>' + t.score.toFixed(4) + '</b><span class="muted">块 ' + t.i + "</span></div><div class='rd-txt'>" + h + "</div></li>";
      }).join("");
      $(".rd-toolmsg code", box).textContent = r.top.map(function (t) { return t.text; }).join("\n");
    }
    $(".rd-go", box).onclick = run;
    $(".rd-input", box).addEventListener("keydown", function (e) { if (e.key === "Enter") run(); });
    $(".rd-k", box).onchange = run;
    $(".rd-corpus", box).onchange = function () { $(".rd-custom", box).hidden = this.value !== "custom"; if (this.value === "custom" && !$(".rd-custom", box).value) $(".rd-custom", box).value = "LangGraph 用状态图编排多个 Agent 节点\nFastAPI 是 Python 的异步 Web 框架\npgvector 让 PostgreSQL 支持向量检索\nRerank 用交叉编码器对候选重新打分\nMCP 统一了工具接入方式"; run(); };
    $(".rd-custom", box).addEventListener("input", function () { clearTimeout(cache.t); cache.t = setTimeout(run, 300); });
    $$(".rd-chips button", box).forEach(function (b) { b.onclick = function () { $(".rd-input", box).value = b.textContent; run(); }; });
    box._run = run; run();
  }

  /* ---------- 初始化 ---------- */
  function init() {
    setupCollapse();
    $$("section.topic pre").forEach(function () {}); enhanceCode(document.querySelector("main"));
    setupDecks(); setupQuizzes(); setupLoopDemo(); setupRagDemo();
    renderDash(); document.addEventListener("progress", renderDash);
    var ea = $("#expandAll"), ca = $("#collapseAll"), rp = $("#resetProgress");
    if (ea) ea.onclick = function () { window.AN.setAll(false); };
    if (ca) ca.onclick = function () { window.AN.setAll(true); };
    if (rp) rp.onclick = function () { if (confirm("确定清空所有卡片标记和测验记录吗？")) { localStorage.removeItem(CARDS); localStorage.removeItem(QZ); $$(".quiz").forEach(function (q) { q._render && q._render(); }); emit(); } };
    revealTarget(location.hash.slice(1));
  }
  init();
})();
