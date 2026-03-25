<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# UI Components

Always use shadcn/ui components instead of raw HTML elements. Never use raw `<img>`, `<button>`, `<input>`, `<select>`, or `<dialog>` — use the corresponding shadcn component (`Avatar`, `Button`, `Input`, `Select`, `Dialog`, etc.). If a shadcn component doesn't exist yet, install it with `npx shadcn@latest add <component>`. Do not customize or override default shadcn component styles in the component files themselves — style via className props at the usage site if needed.
