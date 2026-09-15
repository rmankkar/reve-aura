const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
//const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increase JSON payload limit

// Initialize OpenAI client for NVIDIA NIM
const openai = new OpenAI({
  baseURL: 'https://integrate.api.nvidia.com/v1',
  apiKey: process.env.NVIDIA_API_KEY,
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Reve-Aura Backend is running' });
});

// ADO Configuration - these should be set as environment variables in production
const ADO_ORG_URL = process.env.ADO_ORG_URL;
const ADO_PAT = process.env.ADO_PAT;

// Helper function to make ADO API requests
const adoRequest = async (endpoint, options = {}) => {
  const authHeader = Buffer.from(`:${ADO_PAT}`).toString('base64');

  const url = `${ADO_ORG_URL}/${endpoint}`;
  console.log('ADO REQUEST URL:', url);

  const response = await fetch(`${ADO_ORG_URL}/${endpoint}`, {
    method: options.method || 'GET',
    headers: {
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body,
  });

  if (!response.ok) {
    //throw new Error(`ADO API error: ${response.status} - ${response.statusText}`);
    const errorBody = await response.text();

    console.error('ADO API Error:', {
      status: response.status,
      statusText: response.statusText,
      body: errorBody
    });

    throw new Error(
      `ADO API error: ${response.status} - ${errorBody}`
    );
  }

  return response.json();
};

// ADO API Endpoints
app.get('/api/ado/projects', async (req, res) => {
  try {
    const response = await adoRequest('_apis/projects?stateFilter=WellKnown');
    // Transform to expected format: array of { id, name }
    const projects = response.value.map(project => ({
      id: project.id,
      name: project.name
    }));
    res.json(projects);
  } catch (error) {
    console.error('Error fetching ADO projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects from Azure DevOps' });
  }
});

// Get iterations (including sprints) for a project
app.get('/api/ado/projects/:projectId/iterations', async (req, res) => {
  try {
    const projectId = req.params.projectId;

    // Get classification nodes (iterations) for the project
    // $depth=2 gets two levels deep which should capture most sprint hierarchies
    const response = await adoRequest(`${projectId}/_apis/wit/classificationnodes/iterations/SE/PI21?$depth=2`);

    // Recursively traverse the tree to find all leaf iterations (those with no children)
    const getLeafIterations = (node) => {
      let leaves = [];

      // If this node has no children, it's a leaf iteration (sprint)
      if (!node.children || node.children.length === 0) {
        leaves.push({
          id: node.id,
          name: node.name,
          path: node.path
        });
      } else {
        // Otherwise, recursively check children
        for (const child of node.children) {
          leaves = [...leaves, ...getLeafIterations(child)];
        }
      }

      return leaves;
    };

    // Get all leaf iterations (sprints) - pass the root node directly
    const iterations = getLeafIterations(response);

    res.json(iterations);
  } catch (error) {
    console.error('Error fetching ADO iterations:', error);
    res.status(500).json({ error: 'Failed to fetch iterations from Azure DevOps' });
  }
});

// Get user stories for a project and iteration path
app.get('/api/ado/projects/:projectId/user-stories', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    // Decode the iteration path from URL encoding
    let iterationPath = req.query.iterationPath;

    if (!iterationPath) {
      return res.status(400).json({ error: 'Iteration path is required' });
    }

    // Transform the iteration path from classification nodes format to WIQL format
    // Classification nodes path format: \Global_Data_Project\Iteration\SE\PI21\PI21.1
    // WIQL path format: Global_Data_Project\SE\PI21\PI21.1
    // Steps:
    // 1. Remove leading backslash
    // 2. Remove "\Iteration" from the path
    let wiqlIterationPath = iterationPath;
    if (wiqlIterationPath.startsWith('\\')) {
      wiqlIterationPath = wiqlIterationPath.substring(1);
    }
    wiqlIterationPath = wiqlIterationPath.replace(/\\Iteration(?=\\)/, '');

    // WIQL query to get User Stories (Issue Type = User Story) for the specific iteration
    // Need to escape backslashes in iterationPath for JSON compatibility
    // const escapedIterationPath = wiqlIterationPath.replace(/\\/g, '\\\\');
    const wiqlQuery = {
      query: `SELECT [System.Id], [System.Title]
              FROM WorkItems
              WHERE [System.WorkItemType] = 'User Story'
              AND [System.AreaPath] = 'Global_Data_Project\\B2B\\B2B Blackhawks'
              AND [System.IterationPath] = '${wiqlIterationPath}'
              ORDER BY [System.Id]`
    };

    console.log('WIQL:', JSON.stringify(wiqlQuery));
    console.log('Iteration Path:', wiqlIterationPath);
    
    const wiqlResponse = await adoRequest(`${projectId}/_apis/wit/wiql?api-version=7.1`, {
      method: 'POST',
      body: JSON.stringify(wiqlQuery)
    });

    // If we have work items, get their details
    if (wiqlResponse.workItems && wiqlResponse.workItems.length > 0) {
      const ids = wiqlResponse.workItems.map(item => item.id).join(',');
      const detailsResponse = await adoRequest(`${projectId}/_apis/wit/workitems?ids=${ids}&fields=System.Id,System.Title,System.Description,Microsoft.VSTS.Common.AcceptanceCriteria`);

      // Transform to expected format: array of { id, title }
      const userStories = detailsResponse.value.map(item => ({
        id: item.fields['System.Id'],
        title: item.fields['System.Title'],
        description: item.fields['System.Description'],
        acceptanceCriteria: item.fields['Microsoft.VSTS.Common.AcceptanceCriteria']
      }));

      console.log('Fetched User Stories:', userStories);
      res.json(userStories);
    } else {
      // No work items found
      res.json([]);
    }
  } catch (error) {
    console.error('Error fetching ADO user stories:', error);
    res.status(500).json({ error: 'Failed to fetch user stories from Azure DevOps' });
  }
});

// AI suggestion endpoint
app.post('/api/ai', async (req, res) => {
  try {
    const { story, role } = req.body;

    if (!story || typeof story !== 'string') {
      return res.status(400).json({ error: 'Valid story text is required' });
    }

    // Validate role if provided
    const validRoles = ['BA', 'DEV', 'QA', null];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be BA, DEV, or QA.' });
    }

    // Create role-specific prompt for Nemotron model
    let roleSpecificInstruction = '';
    if (role === 'BA') {
      roleSpecificInstruction = 'As a Business Analyst, focus on business value, requirements clarity, stakeholder needs, and measurable outcomes. Emphasize how the feature delivers value to the business and users.';
    } else if (role === 'DEV') {
      roleSpecificInstruction = 'As a Developer, focus on technical feasibility, implementation details, dependencies, architecture considerations, and technical constraints. Provide specific technical guidance.';
    } else if (role === 'QA') {
      roleSpecificInstruction = 'As a QA Engineer, focus on testability, acceptance criteria, edge cases, quality attributes, validation approaches, and how to verify the feature works correctly.';
    } else {
      roleSpecificInstruction = 'Provide general, balanced suggestions for improving the user story from multiple perspectives.';
    }

    // Check if this is a special request for generating questions (not improvement suggestions)
    let isBAQuestionsRequest = false;
    let isDevQuestionsRequest = false;
    let isQAQuestionsRequest = false;
    let originalStory = story;

    if (role === 'BA' && story && story.startsWith('BA_QUESTIONS_REQUEST:')) {
      isBAQuestionsRequest = true;
      // Extract the original story by removing the prefix
      originalStory = story.substring('BA_QUESTIONS_REQUEST:'.length);
    } else if (role === 'DEV' && story && story.startsWith('DEV_QUESTIONS_REQUEST:')) {
      isDevQuestionsRequest = true;
      // Extract the original story by removing the prefix
      originalStory = story.substring('DEV_QUESTIONS_REQUEST:'.length);
    } else if (role === 'QA' && story && story.startsWith('QA_QUESTIONS_REQUEST:')) {
      isQAQuestionsRequest = true;
      // Extract the original story by removing the prefix
      originalStory = story.substring('QA_QUESTIONS_REQUEST:'.length);
    }

    // Create prompt for Nemotron model
    let prompt = '';

    if (isBAQuestionsRequest) {
      // Special prompt for BA to generate business-focused questions
      prompt = `You are a Business Analyst (BA) expert. Your role is to review user stories and acceptance criteria to ensure they deliver clear business value, have measurable outcomes, and address stakeholder needs.

Review this acceptance criteria and generate specific questions to ask stakeholders for clarification to ensure the story delivers clear business value:

Acceptance Criteria:
"${originalStory}"

Generate 3-5 specific, open-ended questions that a Business Analyst would ask to clarify business objectives, success metrics, stakeholder needs, and value proposition.

Each question should be:

Each question should be:
- Clear and concise
- Focused on business value, outcomes, or stakeholder needs
- Designed to elicit detailed information about goals and success criteria
- Related to measurability, ROI, or business impact

Format your response as a JSON array of strings, where each string is one question.`;
    } else if (isDevQuestionsRequest) {
      // Special prompt for DEV to generate technical-focused questions
      prompt = `You are a Developer expert. Your role is to review user stories and acceptance criteria to assess technical feasibility, identify dependencies, and understand implementation requirements.

Review this acceptance criteria and generate specific questions to ask stakeholders or architects for clarification to ensure the story is technically sound and implementable:

Acceptance Criteria:
"${originalStory}"

Generate 3-5 specific, open-ended questions that a Developer would ask to clarify technical feasibility, dependencies, architecture, and implementation approach.

Each question should be:
- Clear and concise
- Focused on technical aspects, dependencies, or implementation details
- Designed to elicit detailed information about technical requirements
- Related to scalability, performance, security, or integration concerns

Format your response as a JSON array of strings, where each string is one question.`;
    } else if (isQAQuestionsRequest) {
      // Special prompt for QA to generate clarification questions
      prompt = `You are a QA (Quality Assurance) Engineer expert. Your role is to review acceptance criteria and generate clarifying questions that would need to be answered by a Business Analyst to make the story properly defined, testable, and complete.

Review this acceptance criteria and generate specific questions to ask the Business Analyst for clarification:

Acceptance Criteria:
"${originalStory}"

Generate 3-5 specific, open-ended questions that a QA Engineer would ask to clarify ambiguities, identify edge cases, ensure testability, and confirm all requirements are understood.

Each question should be:
- Clear and concise
- Focused on a specific aspect of the criteria
- Designed to elicit detailed information from the BA
- Related to testability, edge cases, or missing details

Format your response as a JSON array of strings, where each string is one question.`;
    } else {
      // Original prompt for BA, DEV, or general cases (including roles for improvement suggestions)
      prompt = `You are an expert user story consultant. Analyze the following user story and provide specific, actionable suggestions for improvement. Focus on making the story more clear, testable, and valuable. Identify vague language, missing elements (who, what, why), and opportunities to add measurable outcomes.

User Story:
"${story}"

${roleSpecificInstruction}

Please provide 3-5 specific suggestions for improving this user story. Each suggestion should be concise and actionable. Format your response as a JSON array of strings, where each string is one suggestion.`;
    }

    // Call NVIDIA NIM's Nemotron model with thinking mode enabled
    const completion = await openai.chat.completions.create({
      model: 'nvidia/nemotron-3-super-120b-a12b',
      messages: [
        {
          role: 'system',
          content: 'You are an expert user story consultant who provides clear, actionable feedback for improving user stories.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 1.0,
      top_p: 0.95,
      max_tokens: 1000,
      stream: false
    });

    // Extract suggestions from the response
    let suggestions = [];
    try {
      const responseContent = completion.choices[0].message.content;
      // Try to parse as JSON array
      suggestions = JSON.parse(responseContent);

      // Ensure it's an array
      if (!Array.isArray(suggestions)) {
        suggestions = [responseContent];
      }
    } catch (parseError) {
      // If JSON parsing fails, treat the response as text and split into lines
      const lines = completion.choices[0].message.content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      // Take first 5 non-empty lines as suggestions
      suggestions = lines.slice(0, 5);
    }

    res.json({ suggestions });
  } catch (error) {
    console.error('Error calling NVIDIA NIM API:', error);
    res.status(500).json({
      error: 'Failed to generate AI suggestions',
      details: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;