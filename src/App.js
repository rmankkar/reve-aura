import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [story, setStory] = useState('');
  const [clarifyingQuestions, setClarifyingQuestions] = useState([]);
  const [aiSuggestions, setAISuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState(null); // null, 'BA', 'DEV', or 'QA'
  const [useAdoUi, setUseAdoUi] = useState(false); // Toggle for ADO UI
  const vagueWords = ['fast', 'should', 'easy', 'simple', 'etc.', 'quickly'];

  // ADO UI state
  const [projects, setProjects] = useState([]);
  const [iterations, setIterations] = useState([]); // Renamed from sprints to iterations
  const [userStories, setUserStories] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedIteration, setSelectedIteration] = useState(null); // Renamed from selectedSprint
  const [selectedUserStory, setSelectedUserStory] = useState(null);
  const [adoError, setAdoError] = useState('');
  const [adoProjectsLoading, setAdoProjectsLoading] = useState(false);
  const [adoIterationsLoading, setAdoIterationsLoading] = useState(false); // Renamed from adoSprintsLoading
  const [adoUserStoriesLoading, setAdoUserStoriesLoading] = useState(false);
  // Team state kept for future use (commented out loading code)
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teams, setTeams] = useState([]);
  const [adoTeamsLoading, setAdoTeamsLoading] = useState(false);

  // Load projects when ADO UI is activated
  useEffect(() => {
    if (useAdoUi) {
      loadProjects();
    }
  }, [useAdoUi]);

  const handleStoryChange = (event) => {
    const newStory = event.target.value;
    setStory(newStory);
    setError(''); // Clear error on new input
    analyzeStory(newStory); // Generate clarifying questions based on vague words

    // Also update AI suggestions if a role is already selected
    if (selectedRole) {
      generateAISuggestions();
    }
  };

  const analyzeStory = (storyText) => {
    const foundWords = vagueWords.filter(word =>
      storyText.toLowerCase().includes(` ${word} `) ||
      storyText.toLowerCase().startsWith(`${word} `) ||
      storyText.toLowerCase().endsWith(` ${word}`) ||
      storyText.toLowerCase() === word
    );

    if (foundWords.length > 0) {
      setClarifyingQuestions(
        foundWords.map(word =>
          `Could you please provide more details about how "${word}" relates to the task?`
        )
      );
    } else {
      setClarifyingQuestions([]);
      setAISuggestions([]); // Clear AI suggestions when no vague words
    }
  };

  const generateAISuggestions = async () => {
    // Only generate suggestions if we have a story and a selected role
    if (!story.trim() || !selectedRole) {
      setAISuggestions([]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      // Prepare the story to send - enhance for question generation based on role
      let enhancedStory = story;

      if (selectedRole === 'QA') {
        // For QA role, add a marker that the backend can detect to generate clarification questions
        enhancedStory = `QA_QUESTIONS_REQUEST:${story}`;
      } else if (selectedRole === 'BA') {
        // For BA role, add a marker to generate business-focused questions
        enhancedStory = `BA_QUESTIONS_REQUEST:${story}`;
      } else if (selectedRole === 'DEV') {
        // For DEV role, add a marker to generate technical-focused questions
        enhancedStory = `DEV_QUESTIONS_REQUEST:${story}`;
      }

      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          story: enhancedStory,
          role: selectedRole
        })
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
    // Only generate suggestions if we have a selected user story and a selected role
    if (!selectedUserStory || !selectedRole) {
      setAISuggestions([]);
      return;
    }

    // Use the acceptance criteria from the selected user story
    const storyText = selectedUserStory.acceptanceCriteria || '';

    // If no acceptance criteria, show error
    if (!storyText.trim()) {
      setError('No acceptance criteria found for the selected user story');
      setAISuggestions([]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      // Prepare the story to send - enhance for question generation based on role
      let enhancedStory = storyText;

      if (selectedRole === 'QA') {
        // For QA role, add a marker that the backend can detect to generate clarification questions
        enhancedStory = `QA_QUESTIONS_REQUEST:${storyText}`;
      } else if (selectedRole === 'BA') {
        // For BA role, add a marker to generate business-focused questions
        enhancedStory = `BA_QUESTIONS_REQUEST:${storyText}`;
      } else if (selectedRole === 'DEV') {
        // For DEV role, add a marker to generate technical-focused questions
        enhancedStory = `DEV_QUESTIONS_REQUEST:${storyText}`;
      }
      // For general case or no specific role enhancement, use the story as-is

      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          story: enhancedStory,
          role: selectedRole
        })
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
  };

  // ADO UI Functions
  const loadProjects = async () => {
    setAdoProjectsLoading(true);
    setAdoError('');
    try {
      const response = await fetch('/api/ado/projects');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setProjects(data);
    } catch (err) {
      console.error('Error loading projects:', err);
      setAdoError('Failed to load projects. Please try again.');
    } finally {
      setAdoProjectsLoading(false);
    }
  };

  
  const loadIterations = async (projectId) => {
    if (!projectId) {
      setIterations([]);
      setSelectedIteration(null);
      setUserStories([]);
      setSelectedUserStory(null);
      return;
    }

    setAdoIterationsLoading(true);
    setAdoError('');
    try {
      const response = await fetch(`/api/ado/projects/${projectId}/iterations`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setIterations(data);
    } catch (err) {
      console.error('Error loading iterations:', err);
      setAdoError('Failed to load iterations. Please try again.');
    } finally {
      setAdoIterationsLoading(false);
    }
  };

  const loadUserStories = async (projectId, iterationPath) => {
    if (!projectId || !iterationPath) {
      setUserStories([]);
      setSelectedUserStory(null);
      return;
    }

    setAdoUserStoriesLoading(true);
    setAdoError('');
    try {
      const response = await fetch(`/api/ado/projects/${projectId}/user-stories?iterationPath=${encodeURIComponent(iterationPath)}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setUserStories(data);
    } catch (err) {
      console.error('Error loading user stories:', err);
      setAdoError('Failed to load user stories. Please try again.');
    } finally {
      setAdoUserStoriesLoading(false);
    }
  };

  const handleProjectChange = (event) => {
    const projectId = event.target.value;
    const parsedProject = projectId ? JSON.parse(projectId) : null;
    setSelectedProject(parsedProject);
    setSelectedIteration(null);
    setUserStories([]);
    setSelectedUserStory(null);

    if (parsedProject) {
      loadIterations(parsedProject.id);
    }
  };

  
  const handleIterationChange = (event) => {
    const iterationId = event.target.value;
    const selectedIterationObj = iterationId ? JSON.parse(iterationId) : null;
    setSelectedIteration(selectedIterationObj);
    setUserStories([]);
    setSelectedUserStory(null);

    // Load user stories using the iteration path
    if (selectedIterationObj && selectedProject) {
      loadUserStories(selectedProject.id, selectedIterationObj.path);
    }
  };

  const handleUserStorySelect = (story) => {
    setSelectedUserStory(story);
  };

  const handleTeamChange = (event) => {
    const teamId = event.target.value;
    setSelectedTeam(teamId ? JSON.parse(teamId) : null);
    // Note: We are not loading sprints based on team anymore because we use iteration path
    // If we want to go back to team-based sprints, we would uncomment the team loading and sprint loading
  };

  const handleToggleAdoUi = () => {
    setUseAdoUi(!useAdoUi);
    // Reset ADO state when toggling
    if (!useAdoUi) {
      setSelectedProject(null);
      setSelectedIteration(null);
      setIterations([]);
      setTeams([]);
      setAdoTeamsLoading(false);
      setUserStories([]);
      setSelectedUserStory(null);
      setAdoError('');
    }
  };

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    // Generate AI suggestions when a role is selected
    generateAISuggestions();
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1 className="App-title">Reve-Aura</h1>
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
              checked={useAdoUi}
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
              {useAdoUi ? 'Switch to Manual Entry Mode' : 'Switch to ADO User Story Mode'}
            </span>
          </label>
        </div>

        {useAdoUi ? (
          // ADO User Story UI
          <div className="ado-ui-section">
            <div className="ado-form-group">
              <label htmlFor="project-select" className="form-label">
                Project:
              </label>
              <select
                id="project-select"
                className="project-select"
                value={selectedProject ? JSON.stringify(selectedProject) : ''}
                onChange={handleProjectChange}
                disabled={adoProjectsLoading}
              >
                <option value="">Select Project</option>
                {projects.map((project) => (
                  <option key={project.id} value={JSON.stringify(project)}>
                    {project.name}
                  </option>
                ))}
              </select>
              {adoProjectsLoading && (
                <span className="loading-indicator">Loading...</span>
              )}
            </div>

            {/* Team Selection - Commented out as we're using hardcoded team */}
            {/* <div className="ado-form-group">
              <label htmlFor="team-select" className="form-label">
                Team:
              </label>
              <select
                id="team-select"
                className="team-select"
                value={selectedTeam ? JSON.stringify(selectedTeam) : ''}
                onChange={handleTeamChange}
                disabled={!selectedProject}
              >
                <option value="">Select Team</option>
                {teams.map((team) => (
                  <option key={team.id} value={JSON.stringify(team)}>
                    {team.name}
                  </option>
                ))}
              </select>
              {!selectedProject && (
                <span className="placeholder-text">Select a project first</span>
              )}
              {adoTeamsLoading && (
                <span className="loading-indicator">Loading...</span>
              )}
            </div> */}

            <div className="ado-form-group">
              <label htmlFor="iteration-select" className="form-label">
                Sprint:
              </label>
              <select
                id="iteration-select"
                className="iteration-select"
                value={selectedIteration ? JSON.stringify(selectedIteration) : ''}
                onChange={handleIterationChange}
                disabled={!selectedProject || adoIterationsLoading}
              >
                <option value="">Select Sprint</option>
                {iterations.map((iteration) => (
                  <option key={iteration.id} value={JSON.stringify(iteration)}>
                    {iteration.name}
                  </option>
                ))}
              </select>
              {!selectedProject && (
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
              {!adoUserStoriesLoading && !adoError && userStories.length === 0 && (
                <div className="empty-state">
                  No user stories found for the selected sprint.
                </div>
              )}
              {!adoUserStoriesLoading && !adoError && userStories.length > 0 && (
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
                      {userStories.map((story) => (
                        <tr
                          key={story.id}
                          className={`user-story-row ${selectedUserStory && selectedUserStory.id === story.id ? 'selected' : ''}`}
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
                              checked={selectedUserStory && selectedUserStory.id === story.id}
                              onChange={(e) => {
                                e.stopPropagation(); // Prevent row click from triggering
                                if (e.target.checked) {
                                  handleUserStorySelect(story);
                                } else {
                                  handleUserStorySelect(null);
                                }
                              }}
                              disabled={
                                selectedUserStory &&
                                selectedUserStory.id !== story.id &&
                                selectedUserStory !== null
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
                  disabled={loading || !selectedUserStory}
                >
                  I'm BA
                </button>
                <button
                  onClick={() => handleRoleSelect('DEV')}
                  className={`role-button dev ${selectedRole === 'DEV' ? 'selected' : ''}`}
                  disabled={loading || !selectedUserStory}
                >
                  I'm DEV
                </button>
                <button
                  onClick={() => handleRoleSelect('QA')}
                  className={`role-button qa ${selectedRole === 'QA' ? 'selected' : ''}`}
                  disabled={loading || !selectedUserStory}
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

            <div className="ado-actions">
              <button
                onClick={handleRefineUserStoryWithAI}
                className="clear-button"
                disabled={
                  !selectedUserStory ||
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

            <button
              onClick={handleClearStory}
              className="clear-button"
              disabled={loading || !selectedUserStory}
            >
              {loading ? 'Processing...' : 'Clear Selection'}
            </button>
          </div>
        ) : (
          // Existing Textbox UI
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
                {/*
                <section className="questions-section">
                  <h2 className="section-title">
                    Clarifying Questions:
                  </h2>
                  <ul className="question-list">
                    {clarifyingQuestions.map((question, index) => (
                      <li key={index}>{question}</li>
                    ))}
                  </ul>
                </section>
                */}

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

                <button
                  onClick={handleClearStory}
                  className="clear-button"
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Clear Story'}
                </button>
              </>
            ) : (
              <>
                {story.trim() !== '' && (
                  <div className="success-message">
                    Great! No vague words detected in your story.
                  </div>
                )}
                <button
                  onClick={handleClearStory}
                  className="clear-button"
                  disabled={story.trim() === '' || loading}
                >
                  Clear Story
                </button>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;