---
description: 'Save the current session to continue in a new chat.'
---

# Continue in New Chat - Session Handoff Generator

## Your Task

Generate a comprehensive continuation prompt that I can use in a new chat session to continue development without losing context. Analyze the current session, then create a structured prompt containing all essential information about what was done, what blockers and bugs exist, key decisions made, and next priorities. The goal is to enable seamless handoff to a new chat without needing to re-explain the project state. I don't want to select the generated prompt manually, instead save this into /chat-sessions/session_X. Put a number in place of X that is one higher than the highest numbered session file in that directory or 1 if there are no existing session files. The prompt should be detailed enough to allow the new chat to pick up right where we left off, including any relevant code snippets, links, or references.