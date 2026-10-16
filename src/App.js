import React, { useState, useEffect } from 'react';
import './App.css';
import DOMPurify from 'dompurify';

function App() {
  const [story, setStory] = useState('');
  const [clarifyingQuestions, setClarifyingQuestions] = useState([]);
  const [aiSuggestions, setAISuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState(null); // null, 'BA', 'DEV', or 'QA'
  const [systemType, setSystemType] = useState(null); // 'ADO' or 'JIRA' from backend
  const [uiMode, setUiMode] = useState('manual'); // 'manual' or 'system'
  const [defaultProjectKey, setDefaultProjectKey] = useState(null); // Default project key from config
  const vagueWords = ['fast', 'should', 'easy', 'simple', 'etc.', 'quickly'];

  // ADO UI state
  const [adoProjects, setAdoProjects] = useState([]);
  const [adoIterations, setAdoIterations] = useState([]);
  const [adoUserStories, setAdoUserStories] = useState([]);
  const [selectedAdoProject, setSelectedAdoProject] = useState(null);
  const [selectedAdoIteration, setSelectedAdoIteration] = useState(null);
  const [selectedAdoUserStory, setSelectedAdoUserStory] = useState(null);
  const [adoError, setAdoError] = useState('');
  const [adoProjectsLoading, setAdoProjectsLoading] = useState(false);
  const [adoIterationsLoading, setAdoIterationsLoading] = useState(false);
  const [adoUserStoriesLoading, setAdoUserStoriesLoading] = useState(false);

  // JIRA UI state
  const [jiraProjects, setJiraProjects] = useState([]);
  const [jiraIterations, setJiraIterations] = useState([]);
  const [jiraUserStories, setJiraUserStories] = useState([]);
  const [selectedJiraProject, setSelectedJiraProject] = useState(null);
  const [selectedJiraIteration, setSelectedJiraIteration] = useState(null);
  const [selectedJiraUserStory, setSelectedJiraUserStory] = useState(null);
  const [jiraError, setJiraError] = useState('');
  const [jiraProjectsLoading, setJiraProjectsLoading] = useState(false);
  const [jiraIterationsLoading, setJiraIterationsLoading] = useState(false);
  const [jiraUserStoriesLoading, setJiraUserStoriesLoading] = useState(false);

  // Selected items (shared between systems)
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedIteration, setSelectedIteration] = useState(null);
  const [selectedUserStory, setSelectedUserStory] = useState(null);

  // Load system type from backend on app load
  useEffect(() => {
    const fetchSystemType = async () => {
      try {
        const response = await fetch('/api/config');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setSystemType(data.systemType);
        setDefaultProjectKey(data.defaultProjectKey || null);
        // Start in system mode (not manual) as per plan
        setUiMode('system');
        // Load projects for the determined system type
        if (data.systemType === 'ADO') {
          loadAdoProjects();
        } else if (data.systemType === 'JIRA') {
          loadJiraProjects();
        }
      } catch (err) {
        console.error('Error fetching system type:', err);
        // Default to ADO if config fetch fails
        setSystemType('ADO');
        setUiMode('system');
        loadAdoProjects();
      }
    };

    fetchSystemType();
  }, []);

  const handleStoryChange = (event) => {
    const newStory = event.target.value;
    setStory(newStory);
    setError('');
    analyzeStory(newStory);
  };

  const analyzeStory = (storyText) => {
    const foundWords = vagueWords.filter(
      (word) =>
        storyText.toLowerCase().includes(` ${word} `) ||
        storyText.toLowerCase().startsWith(`${word} `) ||
        storyText.toLowerCase().endsWith(` ${word}`) ||
        storyText.toLowerCase() === word
    );

    if (foundWords.length > 0) {
      setClarifyingQuestions(
        foundWords.map(
          (word) =>
            `Could you please provide more details about how "${word}" relates to the task?`
        )
      );
    } else {
      setClarifyingQuestions([]);
      setAISuggestions([]);
    }
  };

  const generateAISuggestions = async () => {
    let currentStory = '';
    if (uiMode === 'system') {
      if (systemType === 'ADO' && selectedAdoUserStory) {
        // In ADO mode, use the selected user story's acceptance criteria
        currentStory = selectedAdoUserStory.acceptanceCriteria || '';
      } else if (systemType === 'JIRA' && selectedJiraUserStory) {
        // In JIRA mode, use the selected user story's description
        currentStory = selectedJiraUserStory.description || '';
      }
    } else {
      currentStory = story;
    }

    // Only generate suggestions if we have a selected role
    if (!selectedRole) {
      setAISuggestions([]);
      return;
    }

    setLoading(true);
    setError('');

    try {
      let enhancedStory = currentStory;

      if (selectedRole === 'QA') {
        enhancedStory = `QA_QUESTIONS_REQUEST:${currentStory}`;
      } else if (selectedRole === 'BA') {
        enhancedStory = `BA_QUESTIONS_REQUEST:${currentStory}`;
      } else if (selectedRole === 'DEV') {
        enhancedStory = `DEV_QUESTIONS_REQUEST:${currentStory}`;
      }

      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          story: enhancedStory,
          role: selectedRole,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setAISuggestions(data.suggestions || []);
    } catch (err) {
      console.error('Error fetching AI suggestions:', err);
      setError('Failed to get AI suggestions. Please try again.');
      setAISuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefineUserStoryWithAI = async () => {
    // Determine which story to use based on current mode
    let currentStory = '';
    if (uiMode === 'system') {
      if (systemType === 'ADO' && selectedAdoUserStory) {
        currentStory = selectedAdoUserStory.acceptanceCriteria || '';
      } else if (systemType === 'JIRA' && selectedJiraUserStory) {
        currentStory = selectedJiraUserStory.description || '';
      }
    } else {
      // In manual mode, use the manual story
      currentStory = story;
    }

    // Only generate suggestions if we have a selected role
    if (!selectedRole) {
      setAISuggestions([]);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Prepare the story to send - enhance for question generation based on role
      let enhancedStory = currentStory;

      if (selectedRole === 'QA') {
        // For QA role, add a marker that the backend can detect to generate clarification questions
        enhancedStory = `QA_QUESTIONS_REQUEST:${currentStory}`;
      } else if (selectedRole === 'BA') {
        // For BA role, add a marker to generate business-focused questions
        enhancedStory = `BA_QUESTIONS_REQUEST:${currentStory}`;
      } else if (selectedRole === 'DEV') {
        // For DEV role, add a marker to generate technical-focused questions
        enhancedStory = `DEV_QUESTIONS_REQUEST:${currentStory}`;
      }

      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          story: enhancedStory,
          role: selectedRole,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setAISuggestions(data.suggestions || []);
    } catch (err) {
      console.error('Error fetching AI suggestions:', err);
      setError('Failed to get AI suggestions. Please try again.');
      setAISuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearStory = () => {
    setStory('');
    setClarifyingQuestions([]);
    setAISuggestions([]);
    setError('');
    setLoading(false);
    setSelectedRole(null); // Reset role selection when clearing story
    // Reset selected items based on mode
    if (uiMode === 'system') {
      if (systemType === 'ADO') {
        setSelectedAdoProject(null);
        setSelectedAdoIteration(null);
        setSelectedAdoUserStory(null);
        setSelectedProject(null);
        setSelectedIteration(null);
        setSelectedUserStory(null);
      } else if (systemType === 'JIRA') {
        setSelectedJiraProject(null);
        setSelectedJiraIteration(null);
        setSelectedJiraUserStory(null);
        setSelectedProject(null);
        setSelectedIteration(null);
        setSelectedUserStory(null);
      }
    } else {
      // Manual mode - reset manual story
      setStory('');
    }
  };

  // ADO UI Functions
  const loadAdoProjects = async () => {
    setAdoProjectsLoading(true);
    setAdoError('');

    try {
      const response = await fetch('/api/ado/projects');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setAdoProjects(data);
    } catch (err) {
      console.error('Error loading ADO projects:', err);
      setAdoError('Failed to load projects. Please try again.');
    } finally {
      setAdoProjectsLoading(false);
    }
  };

  const loadAdoIterations = async (projectId) => {
    if (!projectId) {
      setAdoIterations([]);
      setSelectedAdoIteration(null);
      setAdoUserStories([]);
      setSelectedAdoUserStory(null);
      return;
    }

    setAdoIterationsLoading(true);
    setAdoError('');

    try {
      const response = await fetch(
        `/api/ado/projects/${projectId}/iterations`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setAdoIterations(data);
    } catch (err) {
      console.error('Error loading ADO iterations:', err);
      setAdoError('Failed to load iterations. Please try again.');
    } finally {
      setAdoIterationsLoading(false);
    }
  };

  const loadAdoUserStories = async (projectId, iterationPath) => {
    if (!projectId || !iterationPath) {
      setAdoUserStories([]);
      setSelectedAdoUserStory(null);
      return;
    }

    setAdoUserStoriesLoading(true);
    setAdoError('');

    try {
      const response = await fetch(
        `/api/ado/projects/${projectId}/user-stories?iterationPath=${encodeURIComponent(
          iterationPath
        )}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setAdoUserStories(data);
    } catch (err) {
      console.error('Error loading ADO user stories:', err);
      setAdoError('Failed to load user stories. Please try again.');
    } finally {
      setAdoUserStoriesLoading(false);
    }
  };

  // JIRA UI Functions
  const loadJiraProjects = async () => {
    setJiraProjectsLoading(true);
    setJiraError('');
    try {
      const response = await fetch('/api/jira/projects');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setJiraProjects(data);
      // If we have a default project key/name, try to auto-select it (case-insensitive match on name or key)
      if (defaultProjectKey) {
        const defaultProject = data.find(p =>
          p.name.toLowerCase() === defaultProjectKey.toLowerCase() ||
          p.key.toLowerCase() === defaultProjectKey.toLowerCase()
        );
        if (defaultProject) {
          setSelectedJiraProject(defaultProject);
          setSelectedProject(defaultProject);
          // Load sprints for the default project
          loadJiraIterations(defaultProject.key);
        }
      }
    } catch (err) {
      console.error('Error loading JIRA projects:', err);
      setJiraError('Failed to load projects. Please try again.');
    } finally {
      setJiraProjectsLoading(false);
    }
  };

  const loadJiraIterations = async (projectIdOrKey) => {
    if (!projectIdOrKey) {
      setJiraIterations([]);
      setSelectedJiraIteration(null);
      setJiraUserStories([]);
      setSelectedJiraUserStory(null);
      return;
    }

    setJiraIterationsLoading(true);
    setJiraError('');
    try {
      const response = await fetch(`/api/jira/projects/${projectIdOrKey}/iterations`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setJiraIterations(data);
    } catch (err) {
      console.error('Error loading JIRA iterations:', err);
      setJiraError('Failed to load iterations. Please try again.');
    } finally {
      setJiraIterationsLoading(false);
    }
  };

  const loadJiraUserStories = async (projectIdOrKey, sprintId) => {
    if (!projectIdOrKey || !sprintId) {
      setJiraUserStories([]);
      setSelectedJiraUserStory(null);
      return;
    }

    setJiraUserStoriesLoading(true);
    setJiraError('');
    try {
      const response = await fetch(`/api/jira/projects/${projectIdOrKey}/user-stories?sprintId=${sprintId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setJiraUserStories(data);
    } catch (err) {
      console.error('Error loading JIRA user stories:', err);
      setJiraError('Failed to load user stories. Please try again.');
    } finally {
      setJiraUserStoriesLoading(false);
    }
  };

  const handleProjectChange = (event) => {
    const projectId = event.target.value;
    let parsedProject = null;
    if (projectId) {
      try {
        parsedProject = JSON.parse(projectId);
      } catch (e) {
        console.error('Error parsing project:', e);
        parsedProject = null;
      }
    }

    if (uiMode === 'system') {
      if (systemType === 'ADO') {
        setSelectedAdoProject(parsedProject);
        setSelectedProject(parsedProject);
        if (parsedProject) {
          loadAdoIterations(parsedProject.id);
        }
        // Reset iteration and user story
        setSelectedAdoIteration(null);
        setSelectedIteration(null);
        setAdoUserStories([]);
        setSelectedAdoUserStory(null);
        setSelectedUserStory(null);
      } else if (systemType === 'JIRA') {
        setSelectedJiraProject(parsedProject);
        setSelectedProject(parsedProject);
        if (parsedProject) {
          loadJiraIterations(parsedProject.key); // JIRA uses key for iterations endpoint
        }
        // Reset iteration and user story
        setSelectedJiraIteration(null);
        setSelectedIteration(null);
        setJiraUserStories([]);
        setSelectedJiraUserStory(null);
        setSelectedUserStory(null);
      }
    }
  };

  const handleIterationChange = (event) => {
    const iterationId = event.target.value;
    let parsedIteration = null;
    if (iterationId) {
      try {
        parsedIteration = JSON.parse(iterationId);
      } catch (e) {
        console.error('Error parsing iteration:', e);
        parsedIteration = null;
      }
    }

    if (uiMode === 'system') {
      if (systemType === 'ADO') {
        setSelectedAdoIteration(parsedIteration);
        setSelectedIteration(parsedIteration);
        if (parsedIteration && selectedAdoProject) {
          loadAdoUserStories(selectedAdoProject.id, parsedIteration.path);
        }
        // Reset user story
        setSelectedAdoUserStory(null);
        setSelectedUserStory(null);
      } else if (systemType === 'JIRA') {
        setSelectedJiraIteration(parsedIteration);
        setSelectedIteration(parsedIteration);
        if (parsedIteration && selectedJiraProject) {
          loadJiraUserStories(selectedJiraProject.key, parsedIteration.id);
        }
        // Reset user story
        setSelectedJiraUserStory(null);
        setSelectedUserStory(null);
      }
    }
  };

  const handleUserStorySelect = (story) => {
    if (uiMode === 'system') {
      if (systemType === 'ADO') {
        setSelectedAdoUserStory(story);
        setSelectedUserStory(story);
      } else if (systemType === 'JIRA') {
        setSelectedJiraUserStory(story);
        setSelectedUserStory(story);
      }
    }
  };

  const handleToggleAdoUi = () => {
    // Toggle between manual and system mode
    setUiMode(prev => (prev === 'manual' ? 'system' : 'manual'));

    // Reset state when switching modes
    if (uiMode === 'manual') {
      // Switching to system mode - load projects for the system type
      if (systemType === 'ADO') {
        loadAdoProjects();
      } else if (systemType === 'JIRA') {
        loadJiraProjects();
      }
      // Clear manual story
      setStory('');
    } else {
      // Switching to manual mode
      // Clear system data
      if (systemType === 'ADO') {
        setAdoProjects([]);
        setSelectedAdoProject(null);
        setSelectedAdoIteration(null);
        setSelectedAdoUserStory(null);
        setSelectedProject(null);
        setSelectedIteration(null);
        setSelectedUserStory(null);
      } else if (systemType === 'JIRA') {
        setJiraProjects([]);
        setSelectedJiraProject(null);
        setSelectedJiraIteration(null);
        setSelectedJiraUserStory(null);
        setSelectedProject(null);
        setSelectedIteration(null);
        setSelectedUserStory(null);
      }
    }

    // Reset AI suggestions and loading when toggling modes
    setAISuggestions([]);
    setLoading(false);
    setError('');
    setSelectedRole(null);
    setClarifyingQuestions([]);
  };

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    // Generate AI suggestions when a role is selected
    generateAISuggestions();
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="logo-container">
          <div className="logomark"></div>
        </div>

        <p className="App-subtitle">
          Reveal ambiguity. Refine requirements. Build with confidence.
        </p>
      </header>

      <main className="container">

        {/* Toggle Switch */}
        <div className="toggle-switch">
          <label className="toggle-label">
            <input
              className="toggle-input"
              type="checkbox"
              checked={uiMode === 'system'}
              onChange={handleToggleAdoUi}
              style={{ display: 'none' }}
            />

            <span
              className="toggle-slider"
              style={{ cursor: 'pointer', marginLeft: '8px' }}
            ></span>

            <span
              className="toggle-text"
              style={{ cursor: 'pointer' }}
            >
              {uiMode === 'system'
                ? `Switch to Manual Entry Mode`
                : `Switch to ${systemType === 'ADO' ? 'ADO' : 'JIRA'} Entry Mode`}
            </span>
          </label>
        </div>

        {uiMode === 'system' ? (
          // System-specific UI (ADO or JIRA)
          systemType === 'ADO' ? (
            // ADO User Story UI
            <div className="ado-ui-section">
              <div className="ado-form-group">
                <label htmlFor="project-select" className="form-label">
                  Project:
                </label>
                <select
                  id="project-select"
                  className="project-select"
                  value={selectedAdoProject ? JSON.stringify(selectedAdoProject) : ''}
                  onChange={handleProjectChange}
                  disabled={adoProjectsLoading}
                >
                  <option value="">Select Project</option>
                  {adoProjects.map((project) => (
                    <option key={project.id} value={JSON.stringify(project)}>
                      {project.name}
                    </option>
                  ))}
                </select>
                {adoProjectsLoading && (
                  <span className="loading-indicator">Loading...</span>
                )}
              </div>

              <div className="ado-form-group">
                <label htmlFor="iteration-select" className="form-label">
                  Sprint:
                </label>
                <select
                  id="iteration-select"
                  className="iteration-select"
                  value={selectedAdoIteration ? JSON.stringify(selectedAdoIteration) : ''}
                  onChange={handleIterationChange}
                  disabled={!selectedAdoProject || adoIterationsLoading}
                >
                  <option value="">Select Sprint</option>
                  {adoIterations.map((iteration) => (
                    <option key={iteration.id} value={JSON.stringify(iteration)}>
                      {iteration.name}
                    </option>
                  ))}
                </select>
                {!selectedAdoProject && (
                  <span className="placeholder-text">Select a project first</span>
                )}
                {adoIterationsLoading && (
                  <span className="loading-indicator">Loading...</span>
                )}
              </div>

              <div className="ado-user-stories-section">
                <h2 className="section-title">User Stories</h2>
                {adoUserStoriesLoading && (
                  <div className="loading-message">
                    Loading user stories...
                  </div>
                )}
                {adoError && (
                  <div className="error-message">
                    {adoError}
                  </div>
                )}
                {!adoUserStoriesLoading && !adoError && adoUserStories.length === 0 && (
                  <div className="empty-state">
                    No user stories found for the selected sprint.
                  </div>
                )}
                {!adoUserStoriesLoading && !adoError && adoUserStories.length > 0 && (
                  <div className="user-story-table-container">
                    <table className="user-story-table">
                      <thead>
                        <tr>
                          <th className="table-header-select">Select</th>
                          <th className="table-header-id">ADO ID</th>
                          <th className="table-header-title">ADO Title</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adoUserStories.map((story) => (
                          <tr
                            key={story.id}
                            className={`user-story-row ${selectedAdoUserStory && selectedAdoUserStory.id === story.id ? 'selected' : ''}`}
                            onClick={(e) => {
                              // Prevent checkbox double-toggle when clicking row
                              if (e.target.type !== 'checkbox') {
                                const checkbox = e.currentTarget.querySelector('input[type="checkbox"]');
                                if (checkbox) {
                                  checkbox.checked = !checkbox.checked;
                                  handleUserStorySelect(checkbox.checked ? story : null);
                                }
                              }
                            }}
                          >
                            <td className="table-cell-select">
                              <input
                                type="checkbox"
                                checked={selectedAdoUserStory && selectedAdoUserStory.id === story.id}
                                onChange={(e) => {
                                  e.stopPropagation(); // Prevent row click from triggering
                                  if (e.target.checked) {
                                    handleUserStorySelect(story);
                                  } else {
                                    handleUserStorySelect(null);
                                  }
                                }}
                                disabled={
                                  selectedAdoUserStory &&
                                  selectedAdoUserStory.id !== story.id &&
                                  selectedAdoUserStory !== null
                                }
                              />
                            </td>
                            <td className="table-cell-id">#{story.id}</td>
                            <td className="table-cell-title">{story.title}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Role Selection Buttons */}
              <div className="role-selection">
                <h3 className="role-title">Select your role for tailored suggestions:</h3>
                <div className="role-buttons">
                  <button
                    onClick={() => handleRoleSelect('BA')}
                    className={`role-button ba ${selectedRole === 'BA' ? 'selected' : ''}`}
                    disabled={loading || !selectedAdoUserStory}
                  >
                    I'm BA
                  </button>
                  <button
                    onClick={() => handleRoleSelect('DEV')}
                    className={`role-button dev ${selectedRole === 'DEV' ? 'selected' : ''}`}
                    disabled={loading || !selectedAdoUserStory}
                  >
                    I'm DEV
                  </button>
                  <button
                    onClick={() => handleRoleSelect('QA')}
                    className={`role-button qa ${selectedRole === 'QA' ? 'selected' : ''}`}
                    disabled={loading || !selectedAdoUserStory}
                  >
                    I'm QA
                  </button>
                </div>
                {selectedRole && (
                  <p className="role-selected">
                    Selected role: {selectedRole}
                  </p>
                )}
              </div>

              {/* Action Buttons Container */}
              <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                <button
                  onClick={handleRefineUserStoryWithAI}
                  className="refine-button"
                  disabled={
                    !selectedAdoUserStory ||
                    !selectedRole ||
                    adoUserStoriesLoading ||
                    adoIterationsLoading ||
                    adoProjectsLoading
                  }
                >
                  {adoUserStoriesLoading || adoIterationsLoading || adoProjectsLoading
                    ? 'Processing...'
                    : 'Refine User Story with AI'}
                </button>

                <button
                  onClick={handleClearStory}
                  className="clear-button"
                  disabled={loading || !selectedAdoUserStory}
                  style={{ marginLeft: '1rem' }}
                >
                  {loading ? 'Processing...' : 'Clear Selection'}
                </button>

              </div>

              {/* Error Display */}
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {/* AI Suggestions */}
            {(aiSuggestions.length > 0 || loading) && (
              <section className="suggestions-section">

                <h2 className="section-title">
                  AI Suggestions for Improvement:
                </h2>

                {loading ? (
                  <div className="loading-message">
                    Getting AI suggestions...
                  </div>
                ) : (
                  <ul className="suggestion-list">
                    {aiSuggestions.map(
                      (suggestion, index) => (
                        <li key={index}>
                          💡 {suggestion}
                        </li>
                      )
                    )}
                  </ul>
                )}

              </section>
            )}
            </div>
          ) : (
            // JIRA User Story UI
            <div className="ado-ui-section">
              <div className="ado-form-group">
                <label htmlFor="project-select" className="form-label">
                  Project:
                </label>
                <select
                  id="project-select"
                  className="project-select"
                  value={selectedJiraProject ? JSON.stringify(selectedJiraProject) : ''}
                  onChange={handleProjectChange}
                  disabled={jiraProjectsLoading}
                >
                  <option value="">Select Project</option>
                  {jiraProjects.map((project) => (
                    <option key={project.id} value={JSON.stringify(project)}>
                      {project.name} ({project.key})
                    </option>
                  ))}
                </select>
                {jiraProjectsLoading && (
                  <span className="loading-indicator">Loading...</span>
                )}
              </div>

              <div className="ado-form-group">
                <label htmlFor="iteration-select" className="form-label">
                  Sprint:
                </label>
                <select
                  id="iteration-select"
                  className="iteration-select"
                  value={selectedJiraIteration ? JSON.stringify(selectedJiraIteration) : ''}
                  onChange={handleIterationChange}
                  disabled={!selectedJiraProject || jiraIterationsLoading}
                >
                  <option value="">Select Sprint</option>
                  {jiraIterations.map((iteration) => (
                    <option key={iteration.id} value={JSON.stringify(iteration)}>
                      {iteration.name} ({iteration.state})
                    </option>
                  ))}
                </select>
                {!selectedJiraProject && (
                  <span className="placeholder-text">Select a project first</span>
                )}
                {jiraIterationsLoading && (
                  <span className="loading-indicator">Loading...</span>
                )}
              </div>

              <div className="ado-user-stories-section">
                <h2 className="section-title">User Stories</h2>
                {jiraUserStoriesLoading && (
                  <div className="loading-message">
                    Loading user stories...
                  </div>
                )}
                {jiraError && (
                  <div className="error-message">
                    {jiraError}
                  </div>
                )}
                {!jiraUserStoriesLoading && !jiraError && jiraUserStories.length === 0 && (
                  <div className="empty-state">
                    No user stories found for the selected sprint.
                  </div>
                )}
                {!jiraUserStoriesLoading && !jiraError && jiraUserStories.length > 0 && (
                  <div className="user-story-table-container">
                    <table className="user-story-table">
                      <thead>
                        <tr>
                          <th className="table-header-select">Select</th>
                          <th className="table-header-id">JIRA ID</th>
                          <th className="table-header-title">JIRA Title</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jiraUserStories.map((story) => (
                          <tr
                            key={story.id}
                            className={`user-story-row ${selectedJiraUserStory && selectedJiraUserStory.id === story.id ? 'selected' : ''}`}
                            onClick={(e) => {
                              // Prevent checkbox double-toggle when clicking row
                              if (e.target.type !== 'checkbox') {
                                const checkbox = e.currentTarget.querySelector('input[type="checkbox"]');
                                if (checkbox) {
                                  checkbox.checked = !checkbox.checked;
                                  handleUserStorySelect(checkbox.checked ? story : null);
                                }
                              }
                            }}
                          >
                            <td className="table-cell-select">
                              <input
                                type="checkbox"
                                checked={selectedJiraUserStory && selectedJiraUserStory.id === story.id}
                                onChange={(e) => {
                                  e.stopPropagation(); // Prevent row click from triggering
                                  if (e.target.checked) {
                                    handleUserStorySelect(story);
                                  } else {
                                    handleUserStorySelect(null);
                                  }
                                }}
                                disabled={
                                  selectedJiraUserStory &&
                                  selectedJiraUserStory.id !== story.id &&
                                  selectedJiraUserStory !== null
                                }
                              />
                            </td>
                            <td className="table-cell-id">#{story.id}</td>
                            <td className="table-cell-title">{story.title}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Role Selection Buttons */}
              <div className="role-selection">
                <h3 className="role-title">Select your role for tailored suggestions:</h3>
                <div className="role-buttons">
                  <button
                    onClick={() => handleRoleSelect('BA')}
                    className={`role-button ba ${selectedRole === 'BA' ? 'selected' : ''}`}
                    disabled={loading || !selectedJiraUserStory}
                  >
                    I'm BA
                  </button>
                  <button
                    onClick={() => handleRoleSelect('DEV')}
                    className={`role-button dev ${selectedRole === 'DEV' ? 'selected' : ''}`}
                    disabled={loading || !selectedJiraUserStory}
                  >
                    I'm DEV
                  </button>
                  <button
                    onClick={() => handleRoleSelect('QA')}
                    className={`role-button qa ${selectedRole === 'QA' ? 'selected' : ''}`}
                    disabled={loading || !selectedJiraUserStory}
                  >
                    I'm QA
                  </button>
                </div>
                {selectedRole && (
                  <p className="role-selected">
                    Selected role: {selectedRole}
                  </p>
                )}
              </div>

              {/* Action Buttons Container */}
              <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                <button
                  onClick={handleRefineUserStoryWithAI}
                  className="refine-button"
                  disabled={
                    !selectedJiraUserStory ||
                    !selectedRole ||
                    jiraUserStoriesLoading ||
                    jiraIterationsLoading ||
                    jiraProjectsLoading
                  }
                >
                  {jiraUserStoriesLoading || jiraIterationsLoading || jiraProjectsLoading
                    ? 'Processing...'
                    : 'Refine User Story with AI'}
                </button>

                <button
                  onClick={handleClearStory}
                  className="clear-button"
                  disabled={loading || !selectedJiraUserStory}
                  style={{ marginLeft: '1rem' }}
                >
                  {loading ? 'Processing...' : 'Clear Selection'}
                </button>
              </div>

              {/* Error Display */}
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {/* AI Suggestions Section */}
            {(aiSuggestions.length > 0 || loading) && (
              <section className="suggestions-section">
                <h2 className="section-title">
                  AI Suggestions for Improvement:
                </h2>
                {loading ? (
                  <div className="loading-message">
                    Getting AI suggestions...
                  </div>
                ) : (
                  <ul className="suggestion-list">
                    {aiSuggestions.map((suggestion, index) => (
                      <li key={index}>💡 {suggestion}</li>
                    ))}
                  </ul>
                )}
              </section>
            )}
            </div>
          )
          ) : (
            // Manual Entry UI
            <>
              <div className="form-group">
                <label htmlFor="story-input" className="form-label">
                  Enter the User Story Acceptance Critieria:
                </label>
                <textarea
                  id="story-input"
                  className="story-input"
                  rows="6"
                  placeholder="As a [user], I want [action] so that [benefit]..."
                  value={story}
                  onChange={handleStoryChange}
                  aria-describedby="story-help"
                />
                <p id="story-help" className="form-help-text">
                  Avoid vague words like: fast, should, easy, simple, etc., quickly
                </p>
              </div>

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              {clarifyingQuestions.length > 0 ? (
                <>
                  {/* Role Selection Buttons */}
                  <div className="role-selection">
                    <h3 className="role-title">Select your role for tailored suggestions:</h3>
                    <div className="role-buttons">
                      <button
                        onClick={() => handleRoleSelect('BA')}
                        className={`role-button ba ${selectedRole === 'BA' ? 'selected' : ''}`}
                        disabled={loading}
                      >
                        I'm BA
                      </button>
                      <button
                        onClick={() => handleRoleSelect('DEV')}
                        className={`role-button dev ${selectedRole === 'DEV' ? 'selected' : ''}`}
                        disabled={loading}
                      >
                        I'm DEV
                      </button>
                      <button
                        onClick={() => handleRoleSelect('QA')}
                        className={`role-button qa ${selectedRole === 'QA' ? 'selected' : ''}`}
                        disabled={loading}
                      >
                        I'm QA
                      </button>
                    </div>
                    {selectedRole && (
                      <p className="role-selected">
                        Selected role: {selectedRole}
                      </p>
                    )}
                  </div>

                  {/* Action Buttons Container */}
                  <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                    {/* Refine with AI Button */}
                    <button
                      onClick={generateAISuggestions}
                      className="refine-button"
                      disabled={!selectedRole || loading}
                    >
                      {loading ? 'Getting AI suggestions...' : 'Refine user story with AI'}
                    </button>

                    {/* Clear Story Button */}
                    <button
                      onClick={handleClearStory}
                      className="clear-button"
                      disabled={loading}
                      style={{ marginLeft: '1rem' }}
                    >
                      Clear Story
                    </button>
                  </div>

                  {(aiSuggestions.length > 0 || loading) && (
                    <section className="suggestions-section">
                      <h2 className="section-title">
                        AI Suggestions for Improvement:
                      </h2>
                      {loading ? (
                        <div className="loading-message">
                          Getting AI suggestions...
                        </div>
                      ) : (
                        <ul className="suggestion-list">
                          {aiSuggestions.map((suggestion, index) => (
                            <li key={index}>💡 {suggestion}</li>
                          ))}
                        </ul>
                      )}
                    </section>
                  )}
                </>
              ) : (
                <>
                  {story.trim() !== '' && (
                    <div className="success-message">
                      Great! No vague words detected in your story.
                    </div>
                  )}
                  <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                    <button
                      onClick={handleClearStory}
                      className="clear-button"
                      disabled={story.trim() === '' || loading}
                    >
                      Clear Story
                    </button>

                  </div>
                </>
              )}
            </>
          )}
        </main>
      </div>
    );
  }

  export default App;
