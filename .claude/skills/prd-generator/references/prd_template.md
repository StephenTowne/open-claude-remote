# Product Requirements Document Template

This template provides a comprehensive structure for creating Product Requirements Documents (PRDs). Adapt sections based on your needs and project scope.

---

## Document Header

**Product/Feature Name:** [Name]
**Status:** [Draft | In Review | Approved]
**Author:** [Your Name]
**Stakeholders:** [List key stakeholders]
**Date Created:** [YYYY-MM-DD]
**Last Updated:** [YYYY-MM-DD]
**Version:** [1.0]

---

## Executive Summary

**One-liner:** [Single sentence describing the product/feature]

**Overview:** [2-3 paragraph summary of what you're building, why, and expected impact]

**Quick Facts:**
- **Target Users:** [Primary user segment]
- **Problem Solved:** [Core problem being addressed]
- **Key Metric:** [Primary success metric]
- **Target Launch:** [Date or Quarter]

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Goals & Objectives](#goals--objectives)
3. [User Personas](#user-personas)
4. [User Stories & Requirements](#user-stories--requirements)
5. [Success Metrics](#success-metrics)
6. [Scope](#scope)
7. [Technical Considerations](#technical-considerations)
8. [Design & UX Requirements](#design--ux-requirements)
9. [Timeline & Milestones](#timeline--milestones)
10. [Risks & Mitigation](#risks--mitigation)
11. [Dependencies & Assumptions](#dependencies--assumptions)
12. [Open Questions](#open-questions)
13. [Stakeholder Sign-Off](#stakeholder-sign-off)

---

## Problem Statement

### The Problem

[Clearly articulate the problem you're solving. What pain point exists today?]

### Current State

[Describe how users currently handle this problem, including workarounds]

### Impact

**User Impact:**
- [How this affects users]
- [Quantify if possible: "Users spend 30 minutes daily on workarounds"]

**Business Impact:**
- [How this affects the business]
- [Include metrics: "Costs us $X in support tickets monthly"]

### Why Now?

[Explain the urgency or strategic importance of solving this now]

---

## Goals & Objectives

### Business Goals

1. **[Goal 1]:** [Description and expected impact]
2. **[Goal 2]:** [Description and expected impact]
3. **[Goal 3]:** [Description and expected impact]

### User Goals

1. **[Goal 1]:** [What users want to achieve]
2. **[Goal 2]:** [What users want to achieve]
3. **[Goal 3]:** [What users want to achieve]

### Non-Goals

[What we're explicitly NOT trying to achieve with this effort]

---

## User Personas

### Primary Persona: [Name/Type]

**Demographics:**
- Age range: [Range]
- Role/Title: [Role]
- Tech savviness: [Low/Medium/High]
- Location: [Geographic info if relevant]

**Behaviors:**
- [Key behavior pattern 1]
- [Key behavior pattern 2]
- [Key behavior pattern 3]

**Needs & Motivations:**
- [What they need to accomplish]
- [What drives their decision-making]

**Pain Points:**
- [Current frustration 1]
- [Current frustration 2]
- [Current frustration 3]

**Quote:** _"[Verbatim user quote that captures their perspective]"_

### Secondary Persona: [Name/Type]

[Repeat structure as needed for additional personas]

---

## User Stories & Requirements

### Epic: [Epic Name]

#### Must-Have Stories (P0)

##### Story 1: [Feature Name]

**User Story:**
```
As a [user type],
I want to [perform action],
So that [achieve benefit/value].
```

**Acceptance Criteria:**
- [ ] Given [context], when [action], then [expected outcome]
- [ ] Given [context], when [action], then [expected outcome]
- [ ] Edge case: [Specific scenario]

**Priority:** Must Have (P0)
**Effort:** [T-shirt size: XS/S/M/L/XL]
**Dependencies:** [List any dependencies]

---

##### Story 2: [Feature Name]

[Repeat structure]

---

#### Should-Have Stories (P1)

[List P1 stories using same format]

---

#### Nice-to-Have Stories (P2)

[List P2 stories using same format]

---

### Functional Requirements

| Req ID | Description | Priority | Status |
|--------|-------------|----------|--------|
| FR-001 | [Requirement description] | Must Have | Open |
| FR-002 | [Requirement description] | Should Have | Open |
| FR-003 | [Requirement description] | Nice to Have | Open |

### Non-Functional Requirements

| Req ID | Category | Description | Target |
|--------|----------|-------------|--------|
| NFR-001 | Performance | Page load time | < 2 seconds |
| NFR-002 | Availability | Uptime SLA | 99.9% |
| NFR-003 | Security | Data encryption | AES-256 |
| NFR-004 | Accessibility | WCAG compliance | Level AA |

---

## Success Metrics

### Key Performance Indicators (KPIs)

#### Primary Metric (North Star)

**Metric:** [Your North Star Metric]
**Definition:** [How it's calculated]
**Current Baseline:** [Current value]
**Target:** [Target value by launch + X months]
**Why This Metric:** [Why this measures success]

#### Secondary Metrics

| Metric | Current | Target | Timeframe |
|--------|---------|--------|-----------|
| [Metric 1] | [Value] | [Value] | [When] |
| [Metric 2] | [Value] | [Value] | [When] |
| [Metric 3] | [Value] | [Value] | [When] |

### Measurement Framework

**Framework Used:** [AARRR / HEART / Custom]

**Acquisition:**
- [Metric and target]

**Activation:**
- [Metric and target]

**Retention:**
- [Metric and target]

**Revenue:**
- [Metric and target]

**Referral:**
- [Metric and target]

### Analytics Implementation

**Events to Track:**
- `[event_name_1]` - [When triggered]
- `[event_name_2]` - [When triggered]
- `[event_name_3]` - [When triggered]

**Dashboards:**
- [Link to primary dashboard]
- [Link to secondary dashboard]

---

## Scope

### In Scope

**Phase 1 (MVP):**
- [Feature/capability 1]
- [Feature/capability 2]
- [Feature/capability 3]

**Phase 2 (Post-MVP):**
- [Feature/capability 1]
- [Feature/capability 2]

### Out of Scope

**Explicitly Excluded:**
- [Item 1 and why it's excluded]
- [Item 2 and why it's excluded]
- [Item 3 and why it's excluded]

### Future Considerations

**Potential Future Enhancements:**
- [Enhancement 1]
- [Enhancement 2]
- [Enhancement 3]

---

## Technical Considerations

### High-Level Architecture

[Describe the technical approach, architecture diagram link, or key architectural decisions]

### Technology Stack

**Frontend:**
- [Framework/library]
- [Key dependencies]

**Backend:**
- [Language/framework]
- [Key services]

**Infrastructure:**
- [Hosting platform]
- [Database]
- [Caching layer]

### API Requirements

**New Endpoints:**
- `GET /api/v1/[endpoint]` - [Description]
- `POST /api/v1/[endpoint]` - [Description]
- `PUT /api/v1/[endpoint]` - [Description]

**External APIs:**
- [Third-party API 1]
- [Third-party API 2]

### Security Requirements

- **Authentication:** [Method: JWT, OAuth, etc.]
- **Authorization:** [RBAC, ABAC, etc.]
- **Data Encryption:** [At rest and in transit]
- **Compliance:** [GDPR, HIPAA, SOC 2, etc.]
- **Rate Limiting:** [Limits and throttling strategy]

### Performance Requirements

- **Response Time:** [Target: e.g., < 200ms p95]
- **Throughput:** [Requests per second]
- **Concurrency:** [Concurrent users supported]
- **Database:** [Query performance targets]
- **Caching:** [Cache hit rate targets]

### Scalability

- **Expected Load:** [Users, requests, data volume]
- **Growth Projections:** [12-month forecast]
- **Scaling Strategy:** [Horizontal/vertical, auto-scaling]

### Data Considerations

**Data Model:**
- [Key entities and relationships]

**Storage Requirements:**
- [Estimated storage needs]
- [Retention policies]

**Data Migration:**
- [Migration plan if updating existing data]
- [Rollback strategy]

**Privacy & Compliance:**
- PII handling: [How personal data is handled]
- Data deletion: [User data deletion process]
- Audit logging: [What's logged and retained]

---

## Design & UX Requirements

### User Experience Principles

[Key UX principles guiding this feature]

### User Flows

**Primary Flow:**
1. [Step 1]
2. [Step 2]
3. [Step 3]
4. [Final state]

**Alternative Flows:**
- [Alternative scenario 1]
- [Error handling flow]

### Visual Design

**Design Assets:**
- [Link to Figma/Sketch files]
- [Link to design system]

**Key Screens:**
- [Screen 1]: [Link to mockup]
- [Screen 2]: [Link to mockup]
- [Screen 3]: [Link to mockup]

**Design System Components:**
- [Component 1 from design system]
- [Component 2 from design system]
- [New components needed]

### Interaction Patterns

- [Pattern 1: e.g., "Click to expand"]
- [Pattern 2: e.g., "Drag to reorder"]
- [Pattern 3: e.g., "Inline editing"]

### Accessibility (a11y)

**Requirements:**
- WCAG 2.1 Level AA compliance
- Keyboard navigation support
- Screen reader compatibility
- Color contrast ratios (4.5:1 for text)
- Focus indicators visible
- Alternative text for images
- Semantic HTML structure

**Testing:**
- [ ] Keyboard-only navigation test
- [ ] Screen reader test (NVDA/JAWS)
- [ ] Color contrast verification
- [ ] Automated a11y testing (axe/Lighthouse)

### Responsive Design

**Breakpoints:**
- Mobile: 320px - 767px
- Tablet: 768px - 1023px
- Desktop: 1024px+

**Platform-Specific Considerations:**
- [iOS-specific requirements]
- [Android-specific requirements]
- [Web-specific requirements]

---

## Timeline & Milestones

**Target Launch Date:** [YYYY-MM-DD or Q#]

### Phases

| Phase | Deliverables | Owner | Start Date | End Date |
|-------|-------------|-------|------------|----------|
| **Discovery** | Requirements finalized, design approved | PM/Design | [Date] | [Date] |
| **Design** | High-fidelity mockups, user testing | Design | [Date] | [Date] |
| **Development** | Backend + frontend implementation | Engineering | [Date] | [Date] |
| **QA** | Testing complete, bugs resolved | QA | [Date] | [Date] |
| **Beta** | Beta testing with select users | PM/QA | [Date] | [Date] |
| **Launch** | Production release | Engineering | [Date] | [Date] |
| **Post-Launch** | Monitoring, iteration based on data | PM/Engineering | [Date] | [Date] |

### Key Milestones

- **[Date]:** Kickoff meeting
- **[Date]:** Design review
- **[Date]:** Technical design review
- **[Date]:** Development complete
- **[Date]:** QA complete
- **[Date]:** Beta launch
- **[Date]:** General availability
- **[Date]:** Post-launch review

---

## Risks & Mitigation

| Risk | Impact | Probability | Mitigation Strategy | Owner |
|------|--------|------------|---------------------|-------|
| [Risk 1: e.g., "API partner delays"] | High | Medium | [Strategy: e.g., "Build with mock data, switch when ready"] | [Name] |
| [Risk 2] | Medium | High | [Strategy] | [Name] |
| [Risk 3] | Low | Low | [Strategy] | [Name] |

### Contingency Plans

**If [scenario occurs]:**
- Action plan: [Steps to take]
- Decision maker: [Who makes the call]
- Trigger: [What indicates this scenario]

---

## Dependencies & Assumptions

### Dependencies

**Internal:**
- [ ] [Dependency 1: e.g., "Design system update"]
- [ ] [Dependency 2: e.g., "API v2 completion"]
- [ ] [Dependency 3]

**External:**
- [ ] [Dependency 1: e.g., "Third-party API approval"]
- [ ] [Dependency 2]

### Assumptions

- [Assumption 1: e.g., "Users have updated to app version 2.0+"]
- [Assumption 2: e.g., "Budget approved for $X infrastructure costs"]
- [Assumption 3]

---

## Open Questions

Track unresolved items that need decisions:

- [ ] **[Question 1]**
  - **Context:** [Why this matters]
  - **Options:** [List options being considered]
  - **Owner:** [Who will decide]
  - **Deadline:** [When decision needed]

- [ ] **[Question 2]**
  - **Context:**
  - **Options:**
  - **Owner:**
  - **Deadline:**

---

## Stakeholder Sign-Off

| Stakeholder | Role | Review Status | Approved | Date |
|------------|------|---------------|----------|------|
| [Name] | Product Lead | ⏳ Pending / ✅ Complete | ☐ | - |
| [Name] | Engineering Lead | ⏳ Pending / ✅ Complete | ☐ | - |
| [Name] | Design Lead | ⏳ Pending / ✅ Complete | ☐ | - |
| [Name] | QA Lead | ⏳ Pending / ✅ Complete | ☐ | - |
| [Name] | Security | ⏳ Pending / ✅ Complete | ☐ | - |
| [Name] | Legal/Compliance | ⏳ Pending / ✅ Complete | ☐ | - |

---

## Appendix

### References

- [User research findings link]
- [Competitive analysis link]
- [Market research link]
- [Technical design doc link]

### Related Documents

- [Link to design files]
- [Link to API documentation]
- [Link to test plan]

### Glossary

- **[Term 1]:** [Definition]
- **[Term 2]:** [Definition]
- **[Term 3]:** [Definition]

### Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | [YYYY-MM-DD] | [Name] | Initial draft |
| 1.1 | [YYYY-MM-DD] | [Name] | [Changes made] |

---

## Document Usage Notes

**When to use this template:**
- Major new features
- New products
- Significant product enhancements
- Cross-functional initiatives

**When NOT to use this template:**
- Minor bug fixes
- Small UI tweaks
- Maintenance tasks
- Simple A/B tests

**Customization:**
- Remove sections not relevant to your project
- Add sections specific to your domain
- Adjust detail level based on project scope
- Use "Lean PRD" format for smaller projects

**Best Practices:**
- Start with problem, not solution
- Keep it concise but complete
- Use specific, measurable language
- Include visual aids (mockups, diagrams)
- Review with all stakeholders
- Keep it updated as understanding evolves

---

## AI Agent Briefs

> **Purpose:** This section is structured for machine consumption by downstream AI agents.
> Use precise, unambiguous language. Prefer tables and lists over prose.
> Populate all fields; use `N/A` only when genuinely not applicable.

---

### Architecture Design Brief

*Consumed by: architecture design agents*

**Feature Name:** [Feature name matching Document Header]

**Core Domain Entities:**

| Entity | Description |
|--------|-------------|
| [EntityName] | [One-line description of what this entity represents] |
| [EntityName] | [One-line description] |

**External Integrations:**

| Service | Direction | Purpose |
|---------|-----------|---------|
| [Service name] | inbound / outbound / bidirectional | [What data flows and why] |

**Authentication Model:** [e.g., JWT via Authorization header; session cookie; API key]

**Authorization Model:** [e.g., RBAC with roles: admin, editor, viewer; ABAC; none]

**Data Flow Summary:**
[2–4 sentences describing how data enters the system, is processed, stored, and returned. Include async paths if relevant.]

**Non-Functional Requirements for Architecture:**

| Concern | Requirement | Source (PRD section) |
|---------|-------------|----------------------|
| Availability | [e.g., 99.9% uptime SLA] | NFR-002 |
| Latency | [e.g., p95 < 200ms for API responses] | NFR-001 |
| Security | [e.g., all PII encrypted at rest with AES-256] | NFR-003 |
| Compliance | [e.g., GDPR, HIPAA, SOC 2] | NFR-004 |

**Hard Constraints for Architecture:**
- [Constraint 1: e.g., must deploy to existing Kubernetes cluster, no new cloud providers]
- [Constraint 2: e.g., must reuse existing PostgreSQL 14 instance]
- [Constraint 3: e.g., no breaking changes to existing public API]

**Open Architectural Questions:**
- [ ] [Question 1: e.g., Should notifications use polling or WebSocket push?]
- [ ] [Question 2: e.g., Single service or separate microservice for billing logic?]

---

### System Design Constraints

*Consumed by: system design agents*

**Data Entities and Relationships:**

```
[EntityName]
  - id: UUID, primary key
  - [field_name]: [type], [constraints, e.g. NOT NULL, UNIQUE]
  - [field_name]: [type], FK → [OtherEntity].id
  - created_at: TIMESTAMP

[OtherEntity]
  - id: UUID, primary key
  - [field_name]: [type]

Relationships:
  - [EntityName] has many [OtherEntity] (via [field_name])
  - [EntityName] belongs to [ParentEntity]
```

**Required API Surface:**

| Method | Path | Auth Required | Purpose |
|--------|------|---------------|---------|
| GET | `/api/v1/[resource]` | Yes / No / Admin | [What it returns] |
| POST | `/api/v1/[resource]` | Yes | [What it creates] |
| PUT | `/api/v1/[resource]/:id` | Yes | [What it updates] |
| DELETE | `/api/v1/[resource]/:id` | Admin | [What it removes] |

**Performance Budgets:**

| Metric | Budget |
|--------|--------|
| API response latency p50 | [e.g., < 50ms] |
| API response latency p95 | [e.g., < 200ms] |
| API response latency p99 | [e.g., < 500ms] |
| DB queries per request (max) | [e.g., ≤ 5] |
| Response payload size (max) | [e.g., 1 MB] |
| Background job max duration | [e.g., 30 seconds] |

**Scalability Targets:**

| Dimension | Target |
|-----------|--------|
| Concurrent users | [e.g., 500 concurrent] |
| Requests per second (peak) | [e.g., 1,000 RPS] |
| Data volume at 12 months | [e.g., ~5M rows in orders table] |
| Max batch size | [e.g., 100 records per batch job] |

**Deployment Constraints:**

| Component | Current State |
|-----------|--------------|
| Environment | [e.g., AWS EKS, single region us-east-1] |
| Database | [e.g., PostgreSQL 14 on RDS, existing instance] |
| Cache | [e.g., Redis 7 on ElastiCache] |
| Message queue | [e.g., SQS, or none] |
| CDN | [e.g., CloudFront, or none] |

**Compliance and Data Handling:**

| Concern | Requirement |
|---------|-------------|
| PII fields | [List fields containing personal data] |
| Data retention | [e.g., 7 years for financial records; 30 days for logs] |
| Encryption at rest | [e.g., AES-256 for PII columns] |
| Encryption in transit | [e.g., TLS 1.2+ required] |
| Audit log requirements | [e.g., log all writes to user_data table with actor + timestamp] |
| Right to deletion | [e.g., hard delete PII within 30 days of request] |

---

### UI/UX Design Requirements

*Consumed by: UI/UX design agents*

**Primary User Flows:**

1. **[Flow Name]** (Actor: [user type])
   1. [Step 1: user action]
   2. [Step 2: system response]
   3. [Step 3: user action]
   4. Terminal state: [What the user sees/has accomplished]

2. **[Flow Name]** (Actor: [user type])
   1. [Step 1]
   2. [Step 2]
   3. Terminal state: [...]

**Error and Edge Case Flows:**

| Scenario | Trigger | Expected Behavior |
|----------|---------|-------------------|
| Empty state | No data exists yet | [e.g., Show illustration + CTA "Add your first item"] |
| Loading state | Data fetch in progress | [e.g., Skeleton loader, no spinner] |
| Network error | API call fails | [e.g., Toast error, retry button, data persists] |
| Permission denied | User lacks access | [e.g., Redirect to /403, explain required role] |
| [Other edge case] | [Trigger] | [Expected behavior] |

**Screen Inventory:**

| ID | Screen Name | Entry Point | Primary Action | Notes |
|----|-------------|-------------|---------------|-------|
| S01 | [Screen name] | [How user arrives here] | [Main CTA] | [Any constraints] |
| S02 | [Screen name] | [Entry point] | [Main CTA] | |
| S03 | [Screen name] | [Entry point] | [Main CTA] | |

**Key Interaction Patterns:**
- [Pattern 1: e.g., Inline editing — click cell to edit, blur to save]
- [Pattern 2: e.g., Optimistic UI — update local state before API confirmation]
- [Pattern 3: e.g., Infinite scroll for list views, not pagination]
- [Pattern 4: e.g., Keyboard shortcut: Cmd+K for global search]

**Accessibility Requirements:**

| Requirement | Standard / Target |
|-------------|-------------------|
| WCAG compliance | [e.g., Level AA (2.1)] |
| Keyboard navigation | [e.g., All interactive elements reachable via Tab; Escape closes modals] |
| Screen reader support | [e.g., ARIA labels on all icon buttons; live regions for status changes] |
| Color contrast (text) | [e.g., ≥ 4.5:1 for normal text; ≥ 3:1 for large text] |
| Focus indicators | [e.g., 2px solid outline visible on all focused elements] |
| Motion / animation | [e.g., Respect prefers-reduced-motion; no autoplay videos] |

**Design System References:**

| Item | Value |
|------|-------|
| Design system | [e.g., Material Design 3 / Tailwind UI / Custom DS v2] |
| Component library | [e.g., shadcn/ui, MUI, or custom] |
| Components to reuse | [e.g., Button, Modal, DataTable, Toast] |
| New components needed | [e.g., StepProgress, FileUploadZone] |
| Figma file | [Link or "TBD"] |

**Responsive Breakpoints:**

| Breakpoint | Range | Layout Notes |
|------------|-------|-------------|
| Mobile | 320px – 767px | [e.g., Single column; bottom nav bar; hide secondary sidebar] |
| Tablet | 768px – 1023px | [e.g., Two column; side nav collapsed by default] |
| Desktop | 1024px+ | [e.g., Three column; side nav always visible] |

**Platform-Specific Considerations:**

| Platform | Requirement |
|----------|-------------|
| iOS | [e.g., Safe area insets; haptic feedback on success actions] |
| Android | [e.g., Material back button behavior; adaptive icons] |
| Web | [e.g., Support Chrome 100+, Safari 15+, Firefox 100+; no IE] |
