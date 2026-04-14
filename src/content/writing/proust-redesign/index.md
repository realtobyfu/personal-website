---
title: "Redesigning ProustGPT"
date: 2026-03-11
type: essay
description: "I redesigned ProustGPT from a single RAG chatbot into a two-mode app with agentic orchestration. The interesting decisions were about product intent, not just architecture."
tag: "AI Engineering"
draft: false
---

ProustGPT started as a simple RAG chatbot. You typed a question about *In Search of Lost Time*, the backend retrieved relevant passages from Pinecone, and a single LLM call synthesized an answer. Clean, direct, and good enough for a while.

After a few months I hit a ceiling. The app could answer factual questions about the book, but it couldn't compare themes across volumes, couldn't hold a multi-turn conversation that built on itself, and had no concept of *why* you were asking. Were you studying the novel? Or were you using it as a lens on your own life? Those are different conversations and a single flow can't serve both well.

One redesign later: two modes, a complexity-aware routing system, and agentic orchestration on top of the retrieval pipeline.

## Why the Original Design Failed

The core assumption was that every query is a retrieval problem. You ask → we fetch relevant passages → LLM answers. That's the right model for a reference tool.

But Proust readers aren't always looking for references. Some questions are analytical: "how does jealousy manifest differently in Swann and Marcel?" That requires finding passages about two different characters, reading what surrounds them, and synthesizing across volumes. A single retrieval step can't do that.

Other questions aren't retrieval problems at all. Someone describing a smell that brought back a childhood memory isn't looking for a citation. They're reaching for a conversation. Immediately fetching passages about involuntary memory would be the wrong move. Technically correct, tonally obtuse.

The original design collapsed these two things into one flow. The redesign separates them explicitly.

## Designing Two Modes

The central design decision: split the product into two modes that reflect the actual two reasons people use the app.

- **Explore**: literary analysis. You're studying the book — comparing characters, tracing themes, understanding structure. Retrieval is the point.
- **Reflect**: introspective conversation. You're using the book as a lens on your own experience. The corpus is optional context, not the destination.

The temptation was to make this a UI preference, like a toggle that swapped the system prompt. I made a different call. Mode is a full architectural contract: different tool budgets, different backend endpoints, different routing logic. What you pick changes what the system *can* do, not just how it talks.

<div style="overflow-x: auto; margin: 2rem 0;">
<svg viewBox="0 0 800 200" width="800" height="200" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;display:block;">
  <!-- Explore mode -->
  <rect x="30" y="20" width="350" height="170" rx="10" fill="white" stroke="#8b4513" stroke-width="2"/>
  <text x="205" y="48" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#8b4513">Explore Mode</text>
  <text x="205" y="68" text-anchor="middle" font-family="Georgia, serif" font-size="10" fill="#888">Literary analysis — all 6 tools</text>
  <line x1="60" y1="78" x2="350" y2="78" stroke="#e8e2d8" stroke-width="1"/>
  <text x="55" y="100" font-family="monospace" font-size="10" fill="#333">search_passages</text>
  <text x="55" y="118" font-family="monospace" font-size="10" fill="#333">search_by_volume</text>
  <text x="55" y="136" font-family="monospace" font-size="10" fill="#276727">get_adjacent_passages</text>
  <text x="55" y="154" font-family="monospace" font-size="10" fill="#276727">get_chapter_overview</text>
  <text x="55" y="172" font-family="monospace" font-size="10" fill="#276727">find_character_mentions  get_toc</text>
  <rect x="230" y="92" width="32" height="16" rx="3" fill="#fde8e8"/>
  <text x="246" y="103" text-anchor="middle" font-family="monospace" font-size="8" fill="#c53030">API</text>
  <rect x="230" y="110" width="32" height="16" rx="3" fill="#fde8e8"/>
  <text x="246" y="121" text-anchor="middle" font-family="monospace" font-size="8" fill="#c53030">API</text>
  <rect x="250" y="128" width="38" height="16" rx="3" fill="#e6f7e6"/>
  <text x="269" y="139" text-anchor="middle" font-family="monospace" font-size="8" fill="#276727">FREE</text>
  <rect x="250" y="146" width="38" height="16" rx="3" fill="#e6f7e6"/>
  <text x="269" y="157" text-anchor="middle" font-family="monospace" font-size="8" fill="#276727">FREE</text>
  <!-- Reflect mode -->
  <rect x="420" y="20" width="350" height="170" rx="10" fill="white" stroke="#7c3aed" stroke-width="2"/>
  <text x="595" y="48" text-anchor="middle" font-family="Georgia, serif" font-size="14" fill="#7c3aed">Reflect Mode</text>
  <text x="595" y="68" text-anchor="middle" font-family="Georgia, serif" font-size="10" fill="#888">Introspective — 3 tools, used sparingly</text>
  <line x1="450" y1="78" x2="740" y2="78" stroke="#e8e2d8" stroke-width="1"/>
  <text x="445" y="100" font-family="monospace" font-size="10" fill="#333">search_passages</text>
  <text x="445" y="118" font-family="monospace" font-size="10" fill="#276727">get_adjacent_passages</text>
  <text x="445" y="136" font-family="monospace" font-size="10" fill="#276727">find_character_mentions</text>
  <text x="445" y="165" font-family="Georgia, serif" font-size="10" fill="#888" font-style="italic">Default: pure conversation.</text>
  <text x="445" y="181" font-family="Georgia, serif" font-size="10" fill="#888" font-style="italic">Search only when resonance is specific.</text>
</svg>
</div>

This asymmetry is the core design decision. Mode isn't UI skin. It changes the tool budget and the reasoning behavior.

## The Complexity Router

Inside Explore mode, a second decision arises: not every query needs a multi-step agent. A simple first-turn question like "who is Albertine?" can be answered in a single retrieval pass. Routing it through a full LangGraph loop adds latency and cost for no benefit.

The solution is a lightweight router that decides at call time whether to invoke the agent or go straight to RAG:

<div style="overflow-x: auto; margin: 2rem 0;">
<svg viewBox="0 0 800 320" width="800" height="320" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;display:block;">
  <defs>
    <marker id="cr-ah" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#8b4513"/></marker>
    <marker id="cr-ah-green" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#276727"/></marker>
    <marker id="cr-ah-red" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#c53030"/></marker>
  </defs>
  <!-- Query input -->
  <rect x="300" y="10" width="200" height="40" rx="6" fill="#faf6f1" stroke="#8b4513" stroke-width="1.5"/>
  <text x="400" y="35" text-anchor="middle" font-family="Georgia, serif" font-size="12" fill="#8b4513">Incoming Query + History</text>
  <line x1="400" y1="50" x2="400" y2="80" stroke="#8b4513" stroke-width="1.5" marker-end="url(#cr-ah)"/>
  <!-- Router diamond -->
  <polygon points="400,80 500,130 400,180 300,130" fill="white" stroke="#8b4513" stroke-width="2"/>
  <text x="400" y="126" text-anchor="middle" font-family="monospace" font-size="11" fill="#8b4513" font-weight="500">needs_agent()</text>
  <text x="400" y="142" text-anchor="middle" font-family="monospace" font-size="9" fill="#888">complexity check</text>
  <!-- Left path: Fast RAG -->
  <line x1="300" y1="130" x2="140" y2="130" stroke="#276727" stroke-width="2" marker-end="url(#cr-ah-green)"/>
  <text x="220" y="120" text-anchor="middle" font-family="monospace" font-size="10" fill="#276727" font-weight="500">False</text>
  <rect x="20" y="105" width="120" height="50" rx="8" fill="#e8f8e8" stroke="#276727" stroke-width="2"/>
  <text x="80" y="128" text-anchor="middle" font-family="monospace" font-size="12" fill="#276727" font-weight="500">Fast RAG</text>
  <text x="80" y="145" text-anchor="middle" font-family="Georgia, serif" font-size="9" fill="#666">~2–3 seconds</text>
  <!-- Right path: Agent -->
  <line x1="500" y1="130" x2="620" y2="130" stroke="#c53030" stroke-width="2" marker-end="url(#cr-ah-red)"/>
  <text x="560" y="120" text-anchor="middle" font-family="monospace" font-size="10" fill="#c53030" font-weight="500">True</text>
  <rect x="620" y="105" width="160" height="50" rx="8" fill="#fde8e8" stroke="#c53030" stroke-width="2"/>
  <text x="700" y="128" text-anchor="middle" font-family="monospace" font-size="12" fill="#c53030" font-weight="500">ReAct Agent</text>
  <text x="700" y="145" text-anchor="middle" font-family="Georgia, serif" font-size="9" fill="#666">~5–15 seconds</text>
  <!-- Decision rules -->
  <rect x="50" y="200" width="320" height="110" rx="8" fill="white" stroke="#276727" stroke-width="1"/>
  <text x="210" y="222" text-anchor="middle" font-family="monospace" font-size="10" fill="#276727" font-weight="500">Triggers Fast RAG</text>
  <text x="65" y="242" font-family="Georgia, serif" font-size="10" fill="#666">"What is the madeleine scene?"</text>
  <text x="65" y="260" font-family="Georgia, serif" font-size="10" fill="#666">"Tell me about Combray"</text>
  <text x="65" y="278" font-family="Georgia, serif" font-size="10" fill="#666">"Quote about time and memory"</text>
  <text x="65" y="296" font-family="Georgia, serif" font-size="9.5" fill="#888" font-style="italic">Simple, self-contained questions</text>
  <rect x="430" y="200" width="350" height="110" rx="8" fill="white" stroke="#c53030" stroke-width="1"/>
  <text x="605" y="222" text-anchor="middle" font-family="monospace" font-size="10" fill="#c53030" font-weight="500">Triggers Agent</text>
  <text x="445" y="242" font-family="Georgia, serif" font-size="10" fill="#666">"Compare Swann's jealousy to Marcel's"</text>
  <text x="445" y="260" font-family="Georgia, serif" font-size="10" fill="#666">"How does memory evolve across volumes?"</text>
  <text x="445" y="278" font-family="Georgia, serif" font-size="10" fill="#666">"What happens after the Guermantes party?"</text>
  <text x="445" y="296" font-family="Georgia, serif" font-size="9.5" fill="#888" font-style="italic">Comparative, sequential, or follow-up queries</text>
</svg>
</div>

The routing logic is intentionally heuristic: regex patterns for comparative/thematic language, conversation-depth checks, and short-query detection inside active sessions. No ML model. The heuristics are crude but that's fine. The wrong call costs a few hundred milliseconds of extra latency, not a failed response.

```python
# backend/agent.py
def needs_agent(query: str, history: list[dict] | None = None) -> bool:
    if history:
        user_msgs = [m for m in history if m.get("role") == "user"]
        if len(user_msgs) >= 2:
            return True          # Follow-ups need context
    if _COMPLEX_PATTERNS.search(query):
        return True              # Comparative / multi-hop queries
    if history and len(query.split()) <= 6:
        return True              # Short reference in active conversation
    return False
```

The design principle: optimize the common case. Most first-turn questions are simple. Keep those fast.

## Agentic Orchestration: The ReAct Loop

When the router decides a query needs the agent, it invokes a LangGraph ReAct agent. ReAct stands for Reason + Act. The model thinks about what it needs, calls a tool, observes the result, and loops until it has enough to answer.

<div style="overflow-x: auto; margin: 2rem 0;">
<svg viewBox="0 0 800 400" width="800" height="400" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;display:block;">
  <defs>
    <marker id="ag-ah" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#8b4513"/></marker>
    <marker id="ag-ah-blue" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#4285f4"/></marker>
    <marker id="ag-ah-green" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#276727"/></marker>
    <marker id="ag-ah-purple" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#7c3aed"/></marker>
  </defs>
  <text x="400" y="30" text-anchor="middle" font-family="Georgia, serif" font-size="15" fill="#8b4513">ReAct Agent Loop</text>
  <!-- Think -->
  <rect x="280" y="50" width="240" height="55" rx="10" fill="#f3e8fe" stroke="#7c3aed" stroke-width="2"/>
  <text x="400" y="72" text-anchor="middle" font-family="monospace" font-size="12" fill="#7c3aed" font-weight="500">THINK</text>
  <text x="400" y="92" text-anchor="middle" font-family="Georgia, serif" font-size="10.5" fill="#666">"I need passages about Swann's jealousy"</text>
  <!-- Arrow to Act -->
  <path d="M 520 77 Q 580 77 580 140" fill="none" stroke="#7c3aed" stroke-width="1.5" marker-end="url(#ag-ah-purple)"/>
  <!-- Act -->
  <rect x="440" y="135" width="280" height="55" rx="10" fill="#e8f0fe" stroke="#4285f4" stroke-width="2"/>
  <text x="580" y="157" text-anchor="middle" font-family="monospace" font-size="12" fill="#4285f4" font-weight="500">ACT</text>
  <text x="580" y="177" text-anchor="middle" font-family="monospace" font-size="10" fill="#666">search_passages("Swann jealousy")</text>
  <!-- Arrow to Observe -->
  <path d="M 580 190 Q 580 220 500 230" fill="none" stroke="#4285f4" stroke-width="1.5" marker-end="url(#ag-ah-blue)"/>
  <!-- Observe -->
  <rect x="280" y="220" width="240" height="55" rx="10" fill="#e8f8e8" stroke="#276727" stroke-width="2"/>
  <text x="400" y="242" text-anchor="middle" font-family="monospace" font-size="12" fill="#276727" font-weight="500">OBSERVE</text>
  <text x="400" y="262" text-anchor="middle" font-family="Georgia, serif" font-size="10.5" fill="#666">5 passages about Swann's torment returned</text>
  <!-- Arrow back to Think (loop) -->
  <path d="M 280 247 Q 200 247 200 140 Q 200 77 280 77" fill="none" stroke="#276727" stroke-width="1.5" stroke-dasharray="6 4" marker-end="url(#ag-ah-green)"/>
  <text x="155" y="165" text-anchor="middle" font-family="monospace" font-size="9" fill="#888" transform="rotate(-90, 155, 165)">loop up to 4×</text>
  <!-- Final answer -->
  <line x1="400" y1="275" x2="400" y2="310" stroke="#8b4513" stroke-width="2" marker-end="url(#ag-ah)"/>
  <text x="450" y="296" font-family="monospace" font-size="9" fill="#666">enough info</text>
  <rect x="250" y="310" width="300" height="55" rx="10" fill="#faf6f1" stroke="#8b4513" stroke-width="2"/>
  <text x="400" y="332" text-anchor="middle" font-family="monospace" font-size="12" fill="#8b4513" font-weight="500">RESPOND</text>
  <text x="400" y="352" text-anchor="middle" font-family="Georgia, serif" font-size="10.5" fill="#666">Synthesize findings into prose with citations</text>
  <!-- Multi-step annotation -->
  <rect x="590" y="280" width="195" height="90" rx="6" fill="white" stroke="#ddd" stroke-width="1"/>
  <text x="687" y="298" text-anchor="middle" font-family="monospace" font-size="9" fill="#8b4513" font-weight="500">Example multi-step:</text>
  <text x="600" y="315" font-family="monospace" font-size="8.5" fill="#666">1. search_passages("Swann")</text>
  <text x="600" y="330" font-family="monospace" font-size="8.5" fill="#666">2. search_passages("Albertine")</text>
  <text x="600" y="345" font-family="monospace" font-size="8.5" fill="#666">3. get_adjacent(#4521)</text>
  <text x="600" y="360" font-family="monospace" font-size="8.5" fill="#666">4. → final synthesis</text>
</svg>
</div>

The agent caps at four steps (`AGENT_MAX_STEPS = 4`). That's a deliberate product choice. It bounds latency and cost, and forces the agent to plan rather than over-search. In practice most complex queries resolve in two or three steps anyway.

## Reflect Mode: Designing for Restraint

The interesting design problem in Reflect mode was the opposite of Explore: how do you keep an AI from being too eager to retrieve?

A first pass might give Reflect mode the same tools as Explore and rely on a good system prompt to restrain it. That doesn't work well. LLMs find reasons to use tools when tools are available. The model convinces itself that fetching a Proust passage is "helpful" even when it would break the conversational register.

The solution was to remove the tools that enable aggressive retrieval entirely. Reflect gets three tools instead of Explore's six: basic passage search, adjacent context, and character lookup. The volume-filtered search and table-of-contents tools are gone. This makes deep literary excavation mechanically harder, and ordinary conversation the natural default.

The system prompt makes the intent explicit:

> Your DEFAULT mode is pure introspective conversation. Most responses should NOT use tools at all. Only search when the user's experience strongly echoes a specific Proustian theme or moment.

But the prompt alone isn't enough. LLMs find reasons to use tools when tools are available. The constraint in the tool budget is what actually enforces the behavior. You can't prompt your way to reliable restraint.

## The Retrieval Pipeline

Both modes share the same underlying retrieval stack. Whether a request goes through the agent's tool calls or the fast RAG path, it hits the same three-stage pipeline:

<div style="overflow-x: auto; margin: 2rem 0;">
<svg viewBox="0 0 800 340" width="800" height="340" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;display:block;">
  <defs>
    <marker id="rag-ah" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#8b4513"/></marker>
    <marker id="rag-ah-blue" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#4285f4"/></marker>
    <marker id="rag-ah-green" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#276727"/></marker>
    <marker id="rag-ah-accent" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#c9944a"/></marker>
  </defs>
  <!-- Step 1: Query -->
  <rect x="310" y="10" width="180" height="50" rx="8" fill="#faf6f1" stroke="#8b4513" stroke-width="2"/>
  <text x="400" y="40" text-anchor="middle" font-family="Georgia, serif" font-size="13" fill="#8b4513">"What is involuntary memory?"</text>
  <!-- Arrow down -->
  <line x1="400" y1="60" x2="400" y2="90" stroke="#8b4513" stroke-width="1.5" marker-end="url(#rag-ah)"/>
  <text x="445" y="80" font-family="monospace" font-size="9" fill="#666">1. embed query</text>
  <!-- Step 2: Embed -->
  <rect x="325" y="90" width="150" height="40" rx="6" fill="#e8f0fe" stroke="#4285f4" stroke-width="1.5"/>
  <text x="400" y="115" text-anchor="middle" font-family="monospace" font-size="11" fill="#4285f4">Cohere embed-v4.0</text>
  <!-- Arrow down -->
  <line x1="400" y1="130" x2="400" y2="160" stroke="#4285f4" stroke-width="1.5" marker-end="url(#rag-ah-blue)"/>
  <text x="455" y="150" font-family="monospace" font-size="9" fill="#666">2. vector search (k=20)</text>
  <!-- Step 3: Pinecone -->
  <rect x="325" y="160" width="150" height="40" rx="6" fill="#e8f8e8" stroke="#276727" stroke-width="1.5"/>
  <text x="400" y="185" text-anchor="middle" font-family="monospace" font-size="11" fill="#276727">Pinecone</text>
  <!-- Arrow down -->
  <line x1="400" y1="200" x2="400" y2="230" stroke="#276727" stroke-width="1.5" marker-end="url(#rag-ah-green)"/>
  <text x="460" y="220" font-family="monospace" font-size="9" fill="#666">3. rerank → top 5</text>
  <!-- Step 4: Rerank -->
  <rect x="325" y="230" width="150" height="40" rx="6" fill="#fef3e8" stroke="#c9944a" stroke-width="1.5"/>
  <text x="400" y="255" text-anchor="middle" font-family="monospace" font-size="11" fill="#a0522d">Cohere rerank-v3.5</text>
  <!-- Arrow down -->
  <line x1="400" y1="270" x2="400" y2="295" stroke="#c9944a" stroke-width="1.5" marker-end="url(#rag-ah-accent)"/>
  <text x="455" y="288" font-family="monospace" font-size="9" fill="#666">4. generate</text>
  <!-- Step 5: LLM -->
  <rect x="290" y="295" width="220" height="40" rx="6" fill="#f3e8fe" stroke="#7c3aed" stroke-width="1.5"/>
  <text x="400" y="320" text-anchor="middle" font-family="monospace" font-size="11" fill="#7c3aed">Groq / Kimi K2 (131K ctx)</text>
  <!-- Side annotations -->
  <rect x="30" y="155" width="120" height="30" rx="4" fill="white" stroke="#ddd" stroke-width="1"/>
  <text x="90" y="175" text-anchor="middle" font-family="monospace" font-size="10" fill="#888">20 candidates</text>
  <line x1="150" y1="170" x2="320" y2="180" stroke="#ddd" stroke-width="1" stroke-dasharray="4 4"/>
  <rect x="30" y="235" width="120" height="30" rx="4" fill="white" stroke="#ddd" stroke-width="1"/>
  <text x="90" y="255" text-anchor="middle" font-family="monospace" font-size="10" fill="#888">5 best passages</text>
  <line x1="150" y1="250" x2="320" y2="250" stroke="#ddd" stroke-width="1" stroke-dasharray="4 4"/>
  <!-- Context stitching annotation -->
  <rect x="575" y="195" width="190" height="55" rx="6" fill="#fffbeb" stroke="#d4a843" stroke-width="1"/>
  <text x="670" y="215" text-anchor="middle" font-family="monospace" font-size="9.5" fill="#8b6914" font-weight="500">Context Stitching</text>
  <text x="670" y="232" text-anchor="middle" font-family="Georgia, serif" font-size="9" fill="#888">Fetches adjacent passages</text>
  <text x="670" y="244" text-anchor="middle" font-family="Georgia, serif" font-size="9" fill="#888">if text starts/ends mid-sentence</text>
  <line x1="575" y1="220" x2="480" y2="200" stroke="#d4a843" stroke-width="1" stroke-dasharray="4 4"/>
</svg>
</div>

**Vector search.** The query is embedded with Cohere's multilingual model and matched against 12,900 Proust passages in Pinecone. Twenty candidates come back. One nice side effect: because Cohere's embeddings are language-agnostic, a French query about jealousy returns relevant English passages without needing a separate index.

**Rerank.** The Cohere reranker reads all twenty candidates against the query and picks the five most relevant. This two-stage approach consistently beats just increasing `top_k`. Fast ANN search gets you in the neighborhood; the reranker gets you the right passages.

**Context stitching.** Reranked passages are checked for mid-sentence breaks. If a passage starts "...but this only made her jealousy worse," we fetch what came before. Literary text doesn't chunk cleanly.

One retrieval layer, two execution paths above it.

## The Transport Layer

Both modes stream responses over Server-Sent Events. This part of the redesign was less interesting architecturally and more interesting as a debugging exercise.

Production proxies introduce failures that don't exist locally: per-line byte limits that silently truncate large JSON payloads, idle timeouts while the agent is reasoning, and trailing buffer edge cases when the generator ends without a final delimiter. Each was a separate incident. Each needed a targeted fix: chunked SSE framing, keepalive comments, explicit buffer flushing on stream close.

One design choice worth noting: in the agent path, passage sources are emitted *before* the first text token. If a response gets interrupted mid-stream, the passage context has already arrived. The user sees what the model was working from even if they never see the full answer. Context is more durable than prose.

## What the Redesign Was Actually About

Agentic routing landed February 14, the two-mode product model February 15, transport hardening through early March. Each piece landed separately, behind a feature flag, over about three weeks.

But the real change wasn't architectural. It was the shift from thinking about the app as a retrieval system to thinking about it as two distinct modes with different intents. Once that framing clicked, the technical decisions followed naturally: separate endpoints, different tool budgets, a router to keep the fast path fast.

The original design was fine for what it was. The new one just recognizes that someone studying Proust's prose and someone processing their own involuntary memories are having fundamentally different conversations, and tries to serve both on their own terms.

The app is at [proustgpt.com](https://proustgpt.com). Explore if you're reading the book. Reflect if you're using it to think.
