# AI Rules & Compliance Protocol

**CRITICAL: THIS IS A PRODUCTION ENVIRONMENT.**
The following rules are absolute and must be followed by any AI/LLM assistant working on this repository.

## 1. Production Integrity
*   **DO NOT** remove or modify existing functionality unless explicitly instructed to do so.
*   **DO NOT** refactor code for "cleanliness" or "modernization" without a specific request.
*   **DO NOT** change logic that might break existing user flows or devices.

## 2. Code Quality & Completeness
*   **NO PARTIAL CODE:** All code snippets or file writes must be complete and syntactically correct. Never leave placeholders (e.g., `// ... rest of code`).
*   **MUST COMPILE:** Ensure all changes result in valid, working code before finalizing.
*   **STYLE:** Strictly adhere to the existing coding style (indentation, naming conventions, etc.).

## 3. No Unsolicited Optimization
*   Performance optimizations are **FORBIDDEN** unless the user specifically asks for them.
*   If you see inefficient code, note it in the response but **DO NOT CHANGE IT**.

## 4. Documentation & Logging
*   **WORKLOG.md:** Every session must be logged. Record what was done, why, and the result.
*   **PROJECT_DOCUMENTATION.md:** Keep the project overview up to date if structural changes are made.

## 5. File Handling
*   **Verify before Write:** Always read a file before modifying it to ensure context is preserved.
*   **No Deletions:** Do not delete files unless explicitly confirmed by the user.

## 6. Feature Specifications
*   **State Device:** Refer to `STATE_DEVICE_PLAN.md` for implementation details regarding the State Device, JSON structure, and Pairing Wizard flow.

---
*Failure to adhere to these rules may result in system instability and data loss.*
