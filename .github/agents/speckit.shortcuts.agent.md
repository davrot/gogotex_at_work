---
description: Allows the user to simplify the commands
handoffs:
  - label: Mind 127.0.0.1
    agent: speckit.implement
    prompt: Be aware that 127.0.0.1 and localhost are not allowed in the vscode dev environment. read docs/dev-setup.md
    send: true
  - label: Autonomy
    agent: speckit.implement
    prompt: You have full autonomy. Stop asking "Should I...?" or "Would you like me to...?" Just **do** it and tell me what you did, preferably after a **large number** of tasks have been completed.
    send: true
  - label: Timeout
    agent: speckit.implement
    prompt: The test(s) hang. Please use linux timeout to unblock the test flow.
    send: true
  - label: (A)
    agent: speckit.implement
    prompt: Option A
    send: true
  - label: (B)
    agent: speckit.implement
    prompt: Option B
    send: true
  - label: (C)
    agent: speckit.implement
    prompt: Option C
    send: true
  - label: (D)
    agent: speckit.implement
    prompt: Option D
    send: true
  - label: (1)
    agent: speckit.implement
    prompt: Option 1
    send: true
  - label: (2)
    agent: speckit.implement
    prompt: Option 2
    send: true
  - label: (3)
    agent: speckit.implement
    prompt: Option 3
    send: true
  - label: (4)
    agent: speckit.implement
    prompt: Option 4
    send: true
  - label: Yes
    agent: speckit.implement
    prompt: Yes
    send: true
  - label: Okay
    agent: speckit.implement
    prompt: Okay
    send: true
  - label: Continue
    agent: speckit.implement
    prompt: Continue
    send: true
  - label: 8-hour batch: Make
    agent: speckit.implement
    prompt: I need to occupy you for 8 hours with autonomous work. Create an 8-hour batch based on the current state of the project and its tasks that you can perform fully autonomous. 
    send: true
  - label: 8-hour batch: Run
    agent: speckit.implement
    prompt: You have full autonomy. Execute: The current 8-hour batch. Do it now. 
    send: true        
---
