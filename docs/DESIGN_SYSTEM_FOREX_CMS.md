# Forex Control Room - Adaptive Intelligence Workspace
Implementation-grade UI/UX master prompt for `forex-bot-v2` CMS at `cms/`.

This document defines the product-specific visual system, layout logic, component recipes, motion rules, and implementation sequence for a Telegram macro control room. It is intentionally not a generic analytics SaaS spec. It must speak the language of operator/admin publishing, high-impact macro events, schedule/send workflows, AI rewrite, and channel control.

## 1. Image-By-Image Analysis Notes

The reference set is not a single style board. It is a compact design language: one typography card, several frosted analytics mockups, one dark Telegram-style operational card, one bold blue promotional panel, and a few desktop/mobile product views. The CMS should synthesize these into a calm, editorial control room.

| Ref image | What it contributes | What to reuse in Forex CMS |
| --- | --- | --- |
| `image-1db8da3c-3613-44b1-82d5-16fce0042e2a.png` | Urbanist typography card with a deep slate-blue header band, pale sage interior, oversized wordmark, and exact color callouts. | Use Urbanist as the core typeface, anchor the palette on `#163144`, `#1B405B`, `#DFF3EB`, and `#FFFFFF`, and keep the system visually editorial rather than app-default. |
| `image-16fce0042e2a.png` | Soft-focus dashboard canvas with capsule filters, a diagonal hatch line chart, sparse axes, and floating KPI/data tiles. | Use frosted glass cards, pill filters, diagonal hatch fills, and restrained chart labeling. Do not make charts dense or grid-heavy. |
| `image-dc7d06c1-2ab8-4578-9c90-4bb978470587.png` | Dark Telegram-like event card with message bubbles, time stamps, emoji markers, and a high-impact event summary. | This is the closest behavioral reference for event alerts, queued drafts, and send logs. Preserve the chat-native, operational tone, but translate it into polished CMS language. |
| `image-ec25b2d5dbf6.png` | Large KPI number with a curved gauge and a minimal chart fragment. | Use oversized numerals for key macro stats, with one support chart only. KPI cards should feel like a command readout, not a dashboard grid. |
| `image-529be2c61f2f.png` | Bold blue promotional composition with overlapping organic shapes, left-aligned headline, and a capsule CTA. | Reuse the asymmetric bento feeling, large headline blocks, and one dominant CTA. This is the right source for high-energy empty states or featured actions. |
| `image-1d8bb75b4504.png` | Desktop monitor view of the same system with a sidebar, a large KPI, floating cards, and a bottom feedback CTA. | Use a persistent rail, an asymmetrical content field, and a bottom utility cluster with a strong feedback or support CTA. |
| `image-c008fc29-b30f-451a-8f6c-e940c18c33ae.png` | Chart close-up with vertical capsule bars and a hover tooltip. | Add vertical capsule bars for distribution or volume views, with floating tooltip pills and minimal axes. |
| `image-9f5ed9e1010f.png` | Layered analytics cards floating over a soft canvas, with compact action chips and depth separation. | Use overlapping floating cards sparingly, especially for AI suggestions, event summaries, or quick actions. |
| `image-4bb978470587.png` | Tilted panel with a left rail, large number readout, supporting metrics, and a compact control cluster. | Good reference for secondary panels, control surfaces, and dense-but-calmed operational state. |
| `image-21d84a98948f.png` | Another desktop mockup of the same workspace with clearer structure and hierarchy. | Reinforces the rule that the app should feel like an operative workspace with a dominant module and supporting clusters, not equal-weight cards. |
| `image-044a4e98a37f.png` | Mobile view with a hand-held device, large number, and a small chart/gauge on a narrow canvas. | On mobile, keep the top hero simplified, use large numerals, and favor one strong metric over many small cards. |
| `image-3fdb78510ca1.png` | Close mobile gauge view with a single metric and a semicircular arc. | Use semi-circular gauges, minimal chrome, and tiny context chips for mobile status panels. |

### Analysis synthesis

- The references share a calm technical finish, not a loud fintech UI.
- The strongest repeated motif is one dominant module with small support cards orbiting it.
- Typography is intentionally geometric and editorial, with oversized display numbers and tight utility labels.
- Pills are for filters and compact state only. They are not the default container shape.
- Dark surfaces are for operational concentration, not full-dark-mode branding.
- Charts are visual summaries. They should read at a glance and never dominate the entire screen.
- Mobile is not a shrunken desktop. It becomes a hero-first control surface with one metric, one chart, and one action cluster.

## 2. Product Purpose And User Modes Mapped To Routes

This CMS is a Telegram macro control room for an operator/admin who publishes one to two high-impact macro posts per day. The UI should optimize for speed, certainty, and low error rates while still feeling editorial and calm.

| Route | Mode | User job | Layout priority |
| --- | --- | --- | --- |
| `/` | Monitoring + next actions | Check bot health, see the next publication decisions, catch anything blocked. | One dominant status/next-action card, then an asymmetrical bento of health, queue, and upcoming items. |
| `/control` | Execution / ops | Explain automation, inspect control state, manage send/schedule behaviors, and confirm system readiness. | Ops-first surface, more compact than Dashboard, with state, toggles, runbook-like summaries, and safety controls. |
| `/events` | Exploration + creation | Scan the calendar, select a day, inspect event timing, and draft around T-30/T+0 timing. | Month calendar on one side, day panel or drawer on the other, with event rows and AI drafting entry. |
| `/content` and `/content/[id]` | Creation + execution | Write a post, rewrite with AI, attach media, schedule, queue, and send. | Editor-first split layout with a sticky action bar and a context-aware AI/media rail. |
| `/social` | Configuration | Configure Telegram and other channel metadata for syndication paths. | Configuration cards, channel toggles, destination summaries, and non-destructive save actions. |
| `/ai` | AI workspace | Ask for rewrites, summaries, angle changes, and research-backed copy. | Chat or prompt desk, context chips, research hits, and a write-insertion surface. |
| `/settings` | Configuration | Maintain source settings, country inputs, scraping settings, and bot connectivity. | Calm form cards, grouped fields, clear save state, no dashboard theatrics. |
| `/media` | Creation support | Help with image selection, crop, attach, and lightweight preview. | Support workspace only. Keep it small, purposeful, and visibly subordinate to Content. |

### Product principle

- The CMS is a control room, not a reporting portal.
- The primary content unit is a publishable macro post or event-linked draft, not a generic record.
- All screens should help the operator answer four questions quickly: what is happening, what needs attention, what can be published, and what is safe to send.
- Do not use SML vehicle-market language, generic SaaS marketing language, or abstract analytics labels.

## 3. Visual DNA Tokens

These tokens should be encoded as CSS variables and used as the source of truth for the redesign. The first four are confirmed directly from the references. The rest are recommended semantic support tokens derived from the same system.

### Confirmed reference tokens

```css
:root {
  --fx-ops-ink: #163144;         /* near-black operational / sidebar / primary CTA */
  --fx-ops-slate: #1B405B;       /* deep slate-blue gradient start */
  --fx-sage: #DFF3EB;            /* pale sage secondary surface */
  --fx-white: #FFFFFF;           /* clean operational white */
}
```

### Recommended support tokens

```css
:root {
  --fx-canvas: #F7F5F0;          /* warm off-white canvas, inferred from refs */
  --fx-canvas-soft: #EEF2EE;     /* soft alternate canvas for subtle sectioning */
  --fx-border-soft: rgba(22, 49, 68, 0.10);
  --fx-border-strong: rgba(22, 49, 68, 0.18);
  --fx-shadow-soft: 0 18px 50px rgba(22, 49, 68, 0.08);
  --fx-shadow-float: 0 24px 80px rgba(22, 49, 68, 0.12);
  --fx-surface-frost: rgba(255, 255, 255, 0.72);
  --fx-surface-frost-strong: rgba(255, 255, 255, 0.88);
  --fx-surface-dark: #163144;
  --fx-surface-dark-2: #1B405B;
  --fx-success: #9FCA5A;         /* restrained acid-lime-style success accent, use sparingly */
  --fx-warning: #D9A441;
  --fx-danger: #B54B4B;
  --fx-text-strong: #163144;
  --fx-text-soft: rgba(22, 49, 68, 0.72);
  --fx-text-muted: rgba(22, 49, 68, 0.52);
  --fx-chart-ink: #163144;
  --fx-chart-muted: rgba(22, 49, 68, 0.28);
  --fx-chart-grid: rgba(22, 49, 68, 0.08);
}
```

### Semantic rules for token use

- `--fx-ops-ink` is the default dark operational color for sidebars, primary buttons, strong labels, and critical controls.
- `--fx-ops-slate` is for gradients, hero bands, and deep background layers.
- `--fx-sage` is a calm secondary surface. Use it for less urgent content blocks, helper bands, or soft highlighted zones.
- `--fx-white` is for form fields, active cards, and reading surfaces.
- The warm canvas should never become pure gray SaaS white. It should feel lightly tactile, almost paper-like.
- The success accent should be small. Use it for deltas, connected status, and safe completion states, not for branding or large fills.
- Keep borders thin and shadows soft. The design should float, not glow.

## 4. Typography System

### Core decision

Use `Urbanist` as the primary system typeface for all CMS UI. The reference typography card explicitly names Urbanist and shows the exact mood the product needs: geometric, airy, modern, and editorial.

### Migration path from the current codebase

- The current CMS uses `Instrument Sans` and `Source Serif 4`.
- `Instrument Sans` can be treated as a temporary approximation during migration, but the final UI should map the root `--font-sans` token to Urbanist.
- `Source Serif 4` should not be the main UI serif. Keep it only if a deliberate editorial accent is needed for quotes, source notes, or long-form article previews. If the CMS never needs that mode, remove it later.
- The migration should preserve the existing component structure. Swap the font token at the root first, then refine sizes, weights, and tracking.

### Type scale

| Use | Font | Weight | Tracking | Notes |
| --- | --- | --- | --- | --- |
| Page titles | Urbanist | 500 to 700 | `-0.03em` to `-0.02em` | Oversized, editorial, and slightly compressed. |
| Screen subtitles | Urbanist | 400 to 500 | `-0.02em` | Brief, descriptive, never marketing copy. |
| KPI numerals | Urbanist | 300 to 600 | `-0.04em` | Large digits, quiet confidence, no over-styling. |
| Utility labels | Urbanist | 500 to 600 | `0.08em` to `0.14em` uppercase | Small technical captions, chip labels, timestamps, and meta. |
| Body content | Urbanist | 400 to 500 | `-0.01em` | Keep line length generous and reading calm. |
| Event keys, IDs, schedules | Mono stack | 400 to 500 | normal | Use for `event_key`, outbox IDs, UTC stamps, and technical references. |

### Typography rules

- Headings should feel editorial, not generic product chrome.
- Use oversized numbers for KPIs and timing. Numbers should read as operational signals, not spreadsheet cells.
- Utility labels must stay small and crisp. If the label becomes important enough, promote it into a headline or an inline stat.
- Do not use the serif face to make the UI feel old-fashioned. If used at all, it should soften a specific editorial surface, not the whole app.

## 5. Layout And Bento Rules Per Screen

### Global shell

- Desktop should use a fixed left rail and a large main canvas.
- The shell must feel like an operational console with an editorial finish.
- On desktop, the sidebar can be darker and more grounded than the main canvas.
- On mobile, navigation should collapse into compact, pill-like or icon-based controls, but the screen content itself should still obey the bento hierarchy.
- Every screen needs one obvious primary action. Do not scatter equal buttons across the top bar.

### Dashboard `/`

- The Dashboard is a monitoring and next-actions screen, not a KPI wall.
- Use one dominant hero surface. It should summarize the next publication pressure point, bot health, or next high-impact event.
- Surround the hero with 2 to 4 supporting cards only if they are meaningfully different: upcoming event, draft queue, outbox, health, or timing warnings.
- Avoid a 4-card equal grid. The ref language is asymmetrical, not symmetric.
- Keep a small utility cluster near the bottom or lower edge with feedback, logs, or support shortcuts.
- The top row should feel like a command line of cards, not a corporate dashboard strip.

### Events `/events`

- Events is the most compositionally rich screen.
- Use a month calendar or day grid on one side and a day panel or drawer on the other.
- The selected day must expand visually and behaviorally. The rest of the month should recede.
- High-impact events need a visible badge, but the badge must remain compact and quiet.
- Include T-30 and T+0 timing chips in the day panel rows.
- The AI drawer should feel contextual, not global. It should open from the selected event and preserve the event context in the header.
- On mobile, collapse the month view into a hero event card plus a day list or bottom sheet. The gauge-like card treatment from the refs should influence the compact timing/status view.

### Content `/content` and `/content/[id]`

- Content is creation plus execution.
- The left side should be the writing surface. The right side should be the AI and media support rail.
- Keep schedule, send, queue, and rewrite controls in a sticky action bar, not as floating scattered buttons.
- Post identity, status, and send targets should remain visible while editing.
- The user must always know whether they are editing a draft, queueing a scheduled post, or preparing a send.
- Use a clear state ladder: draft, scheduled, queued, sent, failed, archived.

### Control `/control`

- Control is an execution surface, not a report page.
- This screen should favor near-black operational panels, small state cards, and explicit action explanations.
- Put safety and automation explanations before metrics.
- Use dark surfaces for critical states, but keep the content readable and calm.
- The design should feel like a command room with guardrails, not a control panel from an industrial app.

### AI Desk `/ai`

- AI Desk should feel like a focused assistant workspace, not a generic chat app.
- Use a wide conversation rail with prompt presets, research hits, and rewrite insertion controls.
- Make context visible at all times: selected event, selected post, or research scope.
- Do not bury the user in prompt engineering. Provide useful, publishable defaults.

### Settings `/settings`

- Settings should feel like configuration, not analytics.
- Group fields into small, legible cards with strong labels and clear save feedback.
- Use calm forms, not verbose explanatory walls.
- If there is a destructive or high-risk action, isolate it visually and label it plainly.

### Social `/social`

- Social is a configuration workspace for Telegram and future channels.
- Present channels as cards or a side list with clear enabled/disabled states.
- The active network should feel selected, not launched into a separate product.
- Do not overbuild this screen into a social media manager. Telegram is the live path; the others are future-ready stubs.

### Media `/media`

- Media is creation support only.
- Keep it visually lighter than Content and less prominent than Events.
- Use it for crop, attach, preview, and quick asset inspection.
- It should never compete with the core publishing flow.

## 6. Component Recipes

### Sidebar

- Use a dark or deeply grounded rail that reflects `--fx-ops-ink`.
- Include a compact product identity block at the top, nav hierarchy in the middle, and a utility cluster at the bottom.
- Keep badges visible for workload or queue counts, like `15+` and `3`.
- Active state should be a soft contained surface or a thin indicator bar, not just a color change.
- The sidebar should feel like a managed hierarchy, not a flat list of links.

### Calendar day cards

- Day cards should be compact, square-ish, and scan-friendly.
- Show the day number, one small state marker, and a limited number of event chips.
- Highlight high-impact days with a quiet accent, not a loud fill.
- If a day has too many events, show a compact overflow count instead of stacking too much text.
- Selected day cards should expand or deepen in surface treatment.

### Day-panel event rows with T-30 / T+0 chips

- Each row should contain event title, currency, country, actual or forecast metadata, and a relative time indicator.
- T-30 and T+0 chips should be visually distinct but small. They are timing tools, not decorations.
- Use row click or a single primary action, not nested buttons inside cards.
- Keep the row height tight enough to show density, but not so tight that timestamps become unreadable.
- If an event is high impact, the row should gain a more prominent border or accent, not a full-screen banner.

### Content editor AI split

- Left pane: writing canvas, metadata, status, and scheduling controls.
- Right pane: AI rewrite, angle suggestions, research hits, and attachment support.
- Keep the AI pane context-aware and event/post-specific.
- If the AI returns rewrite options, show them as selectable cards or diff blocks, not as one opaque paragraph.
- The editor should support quick insert, replace, and shorten actions.

### KPI card

- One large number, one label, one trend pill, one support note.
- Add a tiny chart or sparkline only when it adds meaning.
- The number should dominate. The label should not fight it.
- Do not put four equal KPI cards in a row unless the screen is explicitly a diagnostic comparison view.

### Capsule chart

- Use thin line charts with diagonal hatch fill as the default macro trend visual.
- Use vertical capsule bars for discrete counts, event volume, or day-level clusters.
- Use semi-circular gauges for compact health or readiness states.
- Keep axes sparse and label only the minimum necessary points.
- Use floating mini-pill filters above the chart when there is a real selection dimension such as event type, channel, or time window.

### Drawer

- Use a frosted glass drawer with a thin technical border and generous radius.
- The drawer should feel lightweight but anchored.
- Sticky headers are appropriate when context and action need to remain visible.
- On mobile, drawers should become bottom sheets or near-full-screen panels with circular back and more controls.

### Buttons

- Primary button: dark filled `--fx-ops-ink` with white text.
- Secondary button: outlined or frosted, never visually louder than the primary.
- Tertiary button: minimal, text-led, and only for low-risk actions.
- Destructive button: reserved for cancel, delete, or force-stop actions, with explicit labels.
- Compact pill buttons are for filters only.
- Circular icon buttons are for back, more, close, and quick utility actions.
- The feedback CTA should feel like the reference bottom utility capsule: strong, dark, and clearly secondary to the main task.

## 7. Motion And Micro-Interactions

- Motion should be calm, short, and functional.
- Use 120 to 180 ms for hover and focus transitions.
- Use 240 to 320 ms for panel reveal, drawer, and route-scoped content expansion.
- Use subtle opacity, translate, and blur changes, not bounce, overshoot, or playful elasticity.
- When a card becomes selected, it should lift a little, tighten its border, or brighten its surface. It should not jump dramatically.
- Filter pills should fade in place and maintain spatial continuity.
- Event selection should animate the selected day and the active row together so the user understands the relationship.
- `prefers-reduced-motion` must disable large transforms, staggered choreography, and decorative parallax.

## 8. Light, Dark, And Mixed Surface Rules

- This system is mixed-surface by design.
- Light canvas and sage surfaces are for reading, editing, and scanning.
- Dark operational surfaces are for navigation, high-risk actions, and command-style areas.
- Do not apply a full dark mode inversion across the whole app unless a specific control room state requires it.
- Dark should feel like a grounded tool surface, not a nightclub interface.
- Mixed surfaces must be intentional. For example, a dark sidebar against a warm canvas main area is good; a random dark card in a light sea of other cards is not.
- On mobile, use a dark hero band or dark header sparingly, then return to light cards and a calm canvas for the rest.

## 9. Accessibility WCAG 2.2 AA

- Preserve semantic headings and landmarks for each route.
- Ensure all text and icon pairings meet AA contrast, including over frosted surfaces and gradients.
- Provide visible keyboard focus states on cards, pills, nav items, inputs, and drawer controls.
- Do not use color alone to indicate event severity, send status, or schedule state. Pair color with label, shape, or icon.
- Calendar cells and event rows must be keyboard reachable and clearly announced.
- T-30 and T+0 statuses need accessible labels and not just visual chips.
- Any live update area, such as outbox status or AI streaming responses, should have appropriate ARIA live treatment.
- Charts need text fallbacks or summaries for key values, not just visuals.
- Touch targets on mobile should remain large enough for reliable operator use.
- Keep line lengths controlled and reading comfort high, especially in content editing surfaces.

## 10. Anti-Patterns Specific To This CMS

- Do not use purple SaaS gradients or generic fintech blue-violet branding.
- Do not use four equal KPI cards as the primary dashboard pattern.
- Do not create a hard-nav flash or white flash when changing routes.
- Do not nest Link buttons inside calendar cards or event rows.
- Do not make every page look like a dashboard. Content, Control, Settings, Social, and AI Desk each have different jobs.
- Do not let the AI workspace become a generic chat box with no event or post context.
- Do not bury schedule/send controls behind too many layers.
- Do not over-label with internal jargon that operators do not need in the moment.
- Do not use tiny text for critical timestamps, queue state, or publish confirmations.
- Do not overuse lime. It is a highlight, not a theme.
- Do not over-stack panels. One dominant module per screen is the rule.
- Do not make the calendar or content editor feel like a spreadsheet.
- Do not change the existing bot or Apify logic in the UI prompt. This is a design directive, not a business-logic rewrite.

## 11. Copy-Paste GOD-LEVEL Implementation Prompt

```text
You are redesigning the forex-bot-v2 CMS in cms/ (Next.js + Tailwind + shadcn) as a Forex Control Room - Adaptive Intelligence Workspace. This is a Telegram macro publishing CMS for an operator/admin who publishes 1-2 high-impact macro posts per day. The UI must feel like a calm, editorial control room, not a generic SaaS dashboard.

Product routes and modes:
- / = Dashboard, monitoring + next actions
- /control = execution / ops
- /events = exploration + creation, with month calendar, day panel, T-30/T+0 timers, and AI drawer
- /content and /content/[id] = creation + execution, with draft editor, schedule, send, AI rewrite, and media support
- /social = configuration
- /ai = AI workspace
- /settings = configuration
- /media = creation support

Visual DNA:
- Use Urbanist as the primary typeface across the CMS. Keep any serif face only as a rare editorial accent if truly needed.
- Confirmed palette tokens: --fx-ops-ink #163144, --fx-ops-slate #1B405B, --fx-sage #DFF3EB, --fx-white #FFFFFF.
- Support with a warm off-white canvas, soft frosted glass surfaces, thin technical borders, soft shadows, and a restrained lime success accent.
- Composition must be asymmetrical bento with one dominant module and a few supporting cards.
- Use oversized display headings, large numerals, compact capsule filters, circular icon buttons, and sparse charts with diagonal hatch fills or capsule bars.
- Mixed light/dark surfaces are required. Dark is for operational rails and command surfaces; light and sage are for reading, editing, and calm scanning.

Screen directives:
- Dashboard: one dominant hero status or next-action module, then supporting cards for bot health, upcoming events, draft queue, and outbox. Avoid four equal KPI cards.
- Events: month grid plus day panel or drawer. Selected day should expand. High-impact events need quiet badges. Event rows need T-30 and T+0 chips. AI should open contextually from the selected event.
- Content: split writing workspace. Left is the editor, right is AI rewrite and media support. Keep schedule, queue, send, and preview controls sticky and obvious. Preserve post status and send targets in view.
- Control: ops-first execution surface with dark, grounded panels, concise explanations, safety states, and clear automation controls.
- AI Desk: a contextual assistant workspace with prompt presets, research hits, and insert/replace actions. It should feel publish-ready, not like a generic chat app.
- Settings: grouped configuration cards and calm forms. No dashboard theatrics.
- Social: channel configuration with Telegram as the live path and other channels as stubs or future-ready options.
- Media: lightweight asset support only, subordinate to Content.

Component rules:
- Sidebar: dark rail, hierarchical nav, active indicator as a soft contained surface or thin bar, workload badges, bottom utility cluster, and a strong feedback CTA.
- Calendar day cards: day number, limited event chips, high-impact accent, overflow count instead of clutter.
- Day-panel event rows: title, currency/country, timing metadata, compact T-30/T+0 chips, one primary action only. Do not nest Link buttons inside rows.
- Content editor AI split: writing surface + AI/media rail, with insertion, rewrite, shorten, and schedule/send actions.
- KPI card: one large number, one label, one trend pill, one support note, optional tiny chart.
- Capsule chart: sparse axes, thin line or capsule bars, floating pill filters, minimal labels.
- Drawer: frosted, rounded, thin border, sticky header, contextual actions.
- Buttons: dark primary, restrained secondary, minimal tertiary, explicit destructive only for destructive actions.

Motion and accessibility:
- Keep transitions calm and short. No bounce, no playful overshoot, no decorative parallax.
- Support reduced motion by disabling transforms and staggered choreography.
- Meet WCAG 2.2 AA contrast and focus requirements.
- Never rely on color alone for state. Pair color with label, icon, or shape.
- Make all critical calendar and publish actions keyboard accessible.

Hard constraints:
- Do not turn the CMS into a generic analytics SaaS.
- Do not use purple branding.
- Do not create equal-weight KPI walls.
- Do not add nested Link buttons on event/calendar cards.
- Do not rewrite bot logic, Apify logic, or backend behavior. This is a UI/UX redesign prompt only.

Execution intent:
- The result should feel like a precise forex publishing console with an editorial finish.
- Every screen must answer: what is happening, what needs attention, what can be published, and what is safe to send.
- Use the reference language: editorial, calm, technical, floating, sparse, and operational.
```

## 12. Implementation Order

1. Establish tokens and typography first. Map `--font-sans` to Urbanist, define the confirmed colors, and wire the semantic surfaces.
2. Rebuild the shell next. Update sidebar, top/nav behavior, mobile navigation, active states, and the bottom utility cluster.
3. Redesign the Dashboard as the first content screen. Make it a monitoring and next-actions surface with one dominant hero module.
4. Rebuild Events second. This is the highest-value workflow screen and should establish the calendar-card, day-panel, and AI drawer pattern.
5. Rebuild Content third. Preserve the current editor/business logic, but restyle the split editor, action bar, and post state surfaces.
6. Update Control after the core publishing flows. Keep it operational and safety-focused.
7. Restyle AI Desk, Settings, Social, and Media to match the same language without forcing dashboard composition onto them.
8. Verify that the UI changes do not rewrite bot, send, scheduling, or Apify logic. This pass is visual and interaction-layer first.

## 13. Final Direction

The CMS should feel like an adaptive intelligence workspace for Telegram macro publishing: quiet, confident, asymmetric, and operational. The user should feel that the interface is helping them decide, rewrite, schedule, and send with fewer mistakes and less noise. The design should borrow the references' geometry, frosted depth, sparse chart language, and mixed surface strategy, but translate all of it into Forex Control Room semantics.
