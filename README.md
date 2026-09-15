# Reve-Aura

A vibrant, interactive tool for improving user stories by detecting vague language and providing AI-powered suggestions tailored to different roles (Business Analyst, Developer, QA). Now with Azure DevOps integration for seamless user story refinement!

## Features

- **Vague Word Detection**: Highlights ambiguous terms like "fast", "should", "easy", etc.
- **Clarifying Questions**: Generates questions to help refine vague terms.
- **Role-Based AI Suggestions**: Get tailored improvement suggestions from NVIDIA's Nemotron model based on your role (BA, DEV, QA).
- **Azure DevOps Integration**: 
  - Seamlessly connect to Azure DevOps to fetch user stories
  - Three-step selection flow: Project → Iteration (Sprint) → User Story
  - Toggle between manual entry and ADO modes
  - Automatically extract acceptance criteria for AI refinement
- **Modern UI**: Dark theme with vibrant accents, smooth animations, and responsive design.
- **Secure API Key Handling**: NVIDIA API key stored only in backend `.env`.

## Tech Stack

- **Frontend**: React 19, CSS3 with animations
- **Backend**: Node.js, Express, OpenAI SDK (configured for NVIDIA NIM)
- **API Communication**: Fetch/AJAX with CORS enabled
- **Azure DevOps Integration**: REST API calls to Azure DevOps Services

## Setup Instructions

### Prerequisites

- Node.js (v16+ recommended)
- npm or yarn
- NVIDIA API key (for accessing nemotron-3-super-120b-a12b model)

### 1. Clone the Repository

```bash
git clone <repository-url>
cd reve-aura
```

### 2. Install Dependencies

#### Frontend

```bash
# From project root
npm install
```

#### Backend

```bash
cd server
npm install
cd ..
```

### 3. Configure Environment Variables

Create a `.env` file in the `server` directory:

```bash
cd server
echo "NVIDIA_API_KEY=your_nvidia_api_key_here" > .env
echo "PORT=5001" >> .env  # Optional, defaults to 5001
cd ..
```

> **Important**: Keep your NVIDIA API key secure. Never commit `.env` to version control.

### 4. Start the Development Servers

You need to run both frontend and backend simultaneously.

#### Option A: Using Two Terminals

**Terminal 1 - Backend**:
```bash
cd server
npm start
# Server runs on http://localhost:5001
```

**Terminal 2 - Frontend**:
```bash
# From project root
npm start
# Frontend runs on http://localhost:3000 (proxies /api to backend)
```

#### Option B: Using Concurrently (if configured)

If you have a script configured, you can run:
```bash
npm run dev:all
```

*(Check package.json for available scripts)*

### 5. Using the Application

#### Manual Entry Mode (Default)
1. Open `http://localhost:3000` in your browser.
2. Enter or paste a user story in the textarea.
3. The app will automatically detect vague words and show clarifying questions.
4. Select your role (BA, DEV, or QA) using the buttons below the questions.
5. AI-generated suggestions will appear based on your selected role.
6. Use "Clear Story" to reset and start over.

#### Azure DevOps Mode
1. Click the toggle switch at the top to switch to "ADO User Story Mode"
2. Select your Azure DevOps project from the dropdown
3. Select an iteration (sprint) from the second dropdown
4. Choose a user story from the list
5. Select your role (BA, DEV, or QA) using the role buttons
6. Click "Refine User Story with AI" to get suggestions based on the selected user story's acceptance criteria
7. Use "Clear Selection" to reset and start over

> **Note**: To use ADO mode, you need to configure Azure DevOps credentials in the backend `.env` file:
> ```
> ADO_ORG_URL=https://dev.azure.com/your-organization
> ADO_PAT=your-personal-access-token
> ```

## Project Structure

```
reve-aura/
├── src/                 # Frontend React source
│   ├── App.js           # Main application component (with ADO integration)
│   ├── App.css          # Styling (dark theme, animations)
│   └── index.js
├── server/              # Backend Node.js/Express
│   ├── server.js        # API endpoints (OpenAI + Azure DevOps integration)
│   ├── .env             # Environment variables (API keys, port, ADO credentials)
│   ├── package.json
│   └── package-lock.json
├── public/              # Static assets
├── package.json         # Frontend dependencies and scripts
└── README.md
```

## API Endpoints

### AI Suggestion Endpoint
The frontend communicates with the backend via:

```
POST /api/ai
Content-Type: application/json

{
  "story": "User story text",
  "role": "BA" | "DEV" | "QA"
}
```

Response:
```json
{
  "suggestions": [
    "Suggestion 1",
    "Suggestion 2",
    "..."
  ]
}
```

### Azure DevOps Endpoints
The backend provides the following endpoints for ADO integration:

```
GET /api/ado/projects
Response: Array of { id: string, name: string }

GET /api/ado/projects/:projectId/iterations
Response: Array of { id: string, name: string, path: string }

GET /api/ado/projects/:projectId/user-stories?iterationPath=:iterationPath
Response: Array of { id: string, title: string, description: string, acceptanceCriteria: string }
```

## Customization

### Changing Vague Words

Edit the `vagueWords` array in `src/App.js` to modify which terms trigger clarifying questions.

### Adjusting AI Parameters

Modify the OpenAI call in `server/server.js` to change temperature, top_p, max_tokens, etc.

### Styling

All styling is in `src/App.css`. Feel free to adjust colors, animations, or layout.

## Deployment

For production builds:

```bash
# Build frontend
npm run build

# The build folder contains static assets to serve
# You can serve these with any static file host or configure your backend to serve them
```

## Troubleshooting

- **Backend not connecting**: Ensure the backend is running on port 5001 and the `.env` file contains a valid NVIDIA_API_KEY.
- **Proxy issues**: The frontend uses Create React App's proxy feature to forward `/api` requests to `http://localhost:5001`. If you change the backend port, update the `"proxy"` field in the root `package.json`.
- **CSS animations causing scroll issues**: If you experience unwanted scrolling, check for `overflow` or animated pseudo-elements in `App.css`.

## Future Scope

Potential enhancements for future versions of Reve-Aura:

- **Additional AI Models**: Support for other AI models beyond NVIDIA Nemotron (e.g., GPT-4, Claude, Llama)
- **Advanced ADO Features**: 
  - Support for team-based iteration selection
  - Ability to create/update user stories directly from the app
  - Integration with ADO pull requests and builds
- **Collaboration Features**: 
  - Real-time collaboration for team refinement sessions
  - Commenting and discussion threads on user stories
  - Version history for story refinements
- **Analytics Dashboard**: 
  - Track improvement metrics over time
  - Role-based suggestion effectiveness tracking
  - Vague word reduction analytics
- **Export/Import Capabilities**: 
  - Export refined stories to various formats (CSV, JSON, Excel)
  - Import existing backlogs for batch refinement
- **Customizable Frameworks**: 
  - Support for different user story formats (e.g., Gherkin, Job Stories)
  - Configurable question templates for different methodologies

## License

This project is open source and available under the MIT License.

---

Enjoy refining your user stories with Reve-Aura! 🚀