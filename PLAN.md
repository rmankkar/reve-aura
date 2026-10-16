# Plan: Add JIRA Linking alongside ADO Linking (Updated)

## Overview
Add JIRA integration to the existing ADO integration, allowing the system to run in either ADO or JIRA mode based on SYSTEM_TYPE config. UI labels use generic "Project" prefix with system-specific text added conditionally.

## Backend Changes (server/server.js)

### 1. Configuration
- Add JIRA environment variables:
  - JIRA_BASE_URL
  - JIRA_EMAIL  
  - JIRA_API_TOKEN
- Keep existing ADO variables:
  - ADO_ORG_URL
  - ADO_PAT
- Add SYSTEM_TYPE env var (ADO or JIRA, defaults to ADO for safety but user will set to JIRA)

### 2. Helper Functions
- Keep existing `adoRequest` function for ADO API calls
- Create `jiraRequest` function for JIRA REST API (Bearer token auth: Base64 of email:api_token)

### 3. API Endpoints
Maintain both ADO and JIRA endpoints:
- ADO endpoints: `/api/ado/*` (existing)
- JIRA endpoints: `/api/jira/*` (new)
Frontend calls appropriate set based on SYSTEM_TYPE

### 4. JIRA API Specifics
- Projects: `GET /rest/api/3/project/search`
- Iterations/Sprints: 
  * Need board mapping: `GET /rest/agile/1.0/board?projectKeyOrId=:projectId`
  * Then sprints: `GET /rest/agile/1.0/board/:boardId/sprint`
- User Stories: `GET /rest/api/3/search` with JQL: `type = Story AND sprint = :sprintId`

## Frontend Changes (src/App.js)

### 1. State Management
Add system type state:
- `systemType`: 'ADO' | 'JIRA' (initialized from backend config)
- Keep separate state for each system's data:
  * ADO: `adoProjects`, `adoIterations`, `adoUserStories`
  * JIRA: `jiraProjects`, `jiraIterations`, `jiraUserStories`
- Loading/error states for each system
- Selected project/iteration/user story (shared between systems)

### 2. Initialization
On app load, fetch system type from backend:
- GET `/api/config` → returns `{ systemType: process.env.SYSTEM_TYPE }`
- Set `systemType` state accordingly

### 3. Conditional Data Loading
Based on `systemType` state:
- If 'ADO': load ADO data, call ADO endpoints
- If 'JIRA': load JIRA data, call JIRA endpoints
- Use appropriate loader functions:
  * `loadAdoProjects()` / `loadJiraProjects()`
  * `loadAdoIterations(projectId)` / `loadJiraIterations(projectId)`
  * `loadAdoUserStories(projectId, iterationPath)` / `loadJiraUserStories(projectId, sprintId)`

### 4. UI Rendering
Generic labels with system-specific suffixes:
- `{systemType === 'ADO' ? 'ADO' : 'JIRA'} ID`
- `{systemType === 'ADO' ? 'ADO' : 'JIRA'} Title`
- Button labels: `Switch to {systemType === 'ADO' ? 'Manual' : systemType} Entry Mode`
- All data tables and dropdowns use system-specific data

### 5. Event Handlers
Unified handlers that check systemType:
- `handleProjectChange` → calls ADO or JIRA loader based on systemType
- `handleIterationChange` → calls ADO or JIRA loader
- Role-based AI suggestions work identically (use selected user story's acceptance criteria)

## Risks & Notes
- JIRA API differs significantly (different endpoints, auth, response formats)
- Iterations concept in JIRA requires board context to get sprints
- User story fields differ: ADO uses `System.Title` etc., JIRA uses different field names
- Consider creating adapter functions to normalize ADO/JIRA responses to common shape
- Environment variables need documentation (.env.example)
- Backward compatibility: if SYSTEM_TYPE not set, defaults to ADO (but user will set explicitly)
- Frontend must handle case where selected system has no data gracefully