import React, { useState, useEffect } from 'react';
import './App.css';
import DOMPurify from 'dompurify';

function App() {
  const [story, setStory] = useState('');
  const [clarifyingQuestions, setClarifyingQuestions] = useState([]);
  const [aiSuggestions, setAISuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState(null);
  const [useAdoUi, setUseAdoUi] = useState(false);

  const [showACModal, setShowACModal] = useState(false);
  const [modalContent, setModalContent] = useState('');

  const vagueWords = ['fast', 'should', 'easy', 'simple', 'etc.', 'quickly'];

  // ADO UI state
  const [projects, setProjects] = useState([]);
  const [iterations, setIterations] = useState([]);
  const [userStories, setUserStories] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedIteration, setSelectedIteration] = useState(null);
  const [selectedUserStory, setSelectedUserStory] = useState(null);
  const [adoError, setAdoError] = useState('');
  const [adoProjectsLoading, setAdoProjectsLoading] = useState(false);
  const [adoIterationsLoading, setAdoIterationsLoading] = useState(false);
  const [adoUserStoriesLoading, setAdoUserStoriesLoading] = useState(false);

  // Load projects when ADO UI is activated
  useEffect(() => {
    if (useAdoUi) {
      loadProjects();
    }
  }, [useAdoUi]);

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

    if (useAdoUi && selectedUserStory) {
      currentStory = selectedUserStory.acceptanceCriteria || '';
    } else {
      currentStory = story;
    }

    if (!currentStory.trim() || !selectedRole) {
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
    if (!selectedUserStory || !selectedRole) {
      setAISuggestions([]);
      return;
    }

    const storyText = selectedUserStory.acceptanceCriteria || '';

    if (!storyText.trim()) {
      setError('No acceptance criteria found for the selected user story');
      setAISuggestions([]);
      return;
    }

    setLoading(true);
    setError('');

    try {
      let enhancedStory = storyText;

      if (selectedRole === 'QA') {
        enhancedStory = `QA_QUESTIONS_REQUEST:${storyText}`;
      } else if (selectedRole === 'BA') {
        enhancedStory = `BA_QUESTIONS_REQUEST:${storyText}`;
      } else if (selectedRole === 'DEV') {
        enhancedStory = `DEV_QUESTIONS_REQUEST:${storyText}`;
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
    setSelectedRole(null);
  };

  // =========================
  // ADO UI FUNCTIONS
  // =========================

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
      const response = await fetch(
        `/api/ado/projects/${projectId}/iterations`
      );

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
      const response = await fetch(
        `/api/ado/projects/${projectId}/user-stories?iterationPath=${encodeURIComponent(
          iterationPath
        )}`
      );

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
    const selectedIterationObj = iterationId
      ? JSON.parse(iterationId)
      : null;

    setSelectedIteration(selectedIterationObj);
    setUserStories([]);
    setSelectedUserStory(null);

    if (selectedIterationObj && selectedProject) {
      loadUserStories(selectedProject.id, selectedIterationObj.path);
    }
  };

  const handleUserStorySelect = (selectedStory) => {
    setSelectedUserStory(selectedStory);
  };

  const handleToggleAdoUi = () => {
    setUseAdoUi(!useAdoUi);
    setAISuggestions([]);
    setLoading(false);

    if (!useAdoUi) {
      setSelectedProject(null);
      setSelectedIteration(null);
      setIterations([]);
      setUserStories([]);
      setSelectedUserStory(null);
      setAdoError('');
    }
  };

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
  };

  // =========================
  // ORIGINAL AC MODAL
  // =========================

  const handleShowACModal = (selectedStory) => {
    const acContent = selectedStory.acceptanceCriteria || 'No acceptance criteria available';
    // Sanitize with DOMPurify, allowing data-* and aria-* attributes
    let cleanContent = DOMPurify.sanitize(acContent, {
      ALLOWED_DATA_ATTR: true,
      ALLOWED_ARIA_ATTR: true
    });
    // Set alt attribute for every image to 'Image unavailable' for fallback
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cleanContent;
    const images = tempDiv.querySelectorAll('img');
    images.forEach(img => {
      img.alt = 'Image unavailable';
    });
    cleanContent = tempDiv.innerHTML;
    setModalContent(cleanContent);
    setShowACModal(true);
  };

  const handleCloseACModal = () => {
    setShowACModal(false);
    setModalContent('');
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="logo-container">
          <div className="logomark">
            <div className="prism"></div>
          </div>

          <div className="logo-text">
            <h1 className="App-title">
              <span className="logo-part">Reve</span>
              <span className="logo-part aura">Aura</span>
            </h1>
          </div>
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
              {useAdoUi
                ? 'Switch to Manual Entry Mode'
                : 'Switch to ADO User Story Mode'}
            </span>
          </label>
        </div>

        {useAdoUi ? (
          /* =========================
             ADO USER STORY UI
             ========================= */
          <div className="ado-ui-section">

            {/* Project */}
            <div className="ado-form-group">
              <label
                htmlFor="project-select"
                className="form-label"
              >
                Project:
              </label>

              <select
                id="project-select"
                className="project-select"
                value={
                  selectedProject
                    ? JSON.stringify(selectedProject)
                    : ''
                }
                onChange={handleProjectChange}
                disabled={adoProjectsLoading}
              >
                <option value="">Select Project</option>

                {projects.map((project) => (
                  <option
                    key={project.id}
                    value={JSON.stringify(project)}
                  >
                    {project.name}
                  </option>
                ))}
              </select>

              {adoProjectsLoading && (
                <span className="loading-indicator">
                  Loading...
                </span>
              )}
            </div>

            {/* Sprint */}
            <div className="ado-form-group">
              <label
                htmlFor="iteration-select"
                className="form-label"
              >
                Sprint:
              </label>

              <select
                id="iteration-select"
                className="iteration-select"
                value={
                  selectedIteration
                    ? JSON.stringify(selectedIteration)
                    : ''
                }
                onChange={handleIterationChange}
                disabled={
                  !selectedProject || adoIterationsLoading
                }
              >
                <option value="">Select Sprint</option>

                {iterations.map((iteration) => (
                  <option
                    key={iteration.id}
                    value={JSON.stringify(iteration)}
                  >
                    {iteration.name}
                  </option>
                ))}
              </select>

              {!selectedProject && (
                <span className="placeholder-text">
                  Select a project first
                </span>
              )}

              {adoIterationsLoading && (
                <span className="loading-indicator">
                  Loading...
                </span>
              )}
            </div>

            {/* User Stories */}
            <div className="ado-user-stories-section">

              <h2 className="section-title">
                User Stories
              </h2>

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

              {!adoUserStoriesLoading &&
                !adoError &&
                userStories.length === 0 && (
                  <div className="empty-state">
                    No user stories found for the selected sprint.
                  </div>
                )}

              {!adoUserStoriesLoading &&
                !adoError &&
                userStories.length > 0 && (
                  <div className="user-story-table-container">

                    <table className="user-story-table">

                      <thead>
                        <tr>
                          <th className="table-header-select">
                            Select
                          </th>

                          <th className="table-header-id">
                            ADO ID
                          </th>

                          <th className="table-header-title">
                            ADO Title
                          </th>

                          <th className="table-header-original-ac">
                            Original AC
                          </th>
                        </tr>
                      </thead>

                      <tbody>

                        {userStories.map((story) => (
                          <tr
                            key={story.id}
                            className={`user-story-row ${
                              selectedUserStory &&
                              selectedUserStory.id === story.id
                                ? 'selected'
                                : ''
                            }`}
                            onClick={(e) => {

                              if (
                                e.target.type !== 'checkbox' &&
                                !e.target.closest(
                                  '.original-ac-link'
                                )
                              ) {
                                const checkbox =
                                  e.currentTarget.querySelector(
                                    'input[type="checkbox"]'
                                  );

                                if (checkbox) {
                                  checkbox.checked =
                                    !checkbox.checked;

                                  handleUserStorySelect(
                                    checkbox.checked
                                      ? story
                                      : null
                                  );
                                }
                              }
                            }}
                          >

                            {/* Select */}
                            <td className="table-cell-select">
                              <input
                                type="checkbox"
                                checked={
                                  selectedUserStory &&
                                  selectedUserStory.id === story.id
                                }
                                onChange={(e) => {
                                  e.stopPropagation();

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

                            {/* ADO ID */}
                            <td className="table-cell-id">
                              #{story.id}
                            </td>

                            {/* ADO Title */}
                            <td className="table-cell-title">
                              {story.title}
                            </td>

                            {/* Original AC */}
                            <td className="table-cell-original-ac">
                              <a
                                href="#"
                                className="original-ac-link"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleShowACModal(story);
                                }}
                              >
                                Link
                              </a>
                            </td>

                          </tr>
                        ))}

                      </tbody>
                    </table>
                  </div>
                )}

            </div>

            {/* Role Selection */}
            <div className="role-selection">

              <h3 className="role-title">
                Select your role for tailored suggestions:
              </h3>

              <div className="role-buttons">

                <button
                  onClick={() => handleRoleSelect('BA')}
                  className={`role-button ba ${
                    selectedRole === 'BA'
                      ? 'selected'
                      : ''
                  }`}
                  disabled={loading || !selectedUserStory}
                >
                  I'm BA
                </button>

                <button
                  onClick={() => handleRoleSelect('DEV')}
                  className={`role-button dev ${
                    selectedRole === 'DEV'
                      ? 'selected'
                      : ''
                  }`}
                  disabled={loading || !selectedUserStory}
                >
                  I'm DEV
                </button>

                <button
                  onClick={() => handleRoleSelect('QA')}
                  className={`role-button qa ${
                    selectedRole === 'QA'
                      ? 'selected'
                      : ''
                  }`}
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

            {/* Action Buttons */}
            <div
              style={{
                textAlign: 'center',
                marginTop: '1.5rem',
              }}
            >

              <button
                onClick={handleRefineUserStoryWithAI}
                className="refine-button"
                disabled={
                  !selectedUserStory ||
                  !selectedRole ||
                  adoUserStoriesLoading ||
                  adoIterationsLoading ||
                  adoProjectsLoading
                }
              >
                {adoUserStoriesLoading ||
                adoIterationsLoading ||
                adoProjectsLoading
                  ? 'Processing...'
                  : 'Refine User Story with AI'}
              </button>

              <button
                onClick={handleClearStory}
                className="clear-button"
                disabled={loading || !selectedUserStory}
                style={{ marginLeft: '1rem' }}
              >
                {loading
                  ? 'Processing...'
                  : 'Clear Selection'}
              </button>

            </div>

            {/* Error */}
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
          /* =========================
             MANUAL ENTRY UI
             ========================= */
          <>
            <div className="form-group">

              <label
                htmlFor="story-input"
                className="form-label"
              >
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

              <p
                id="story-help"
                className="form-help-text"
              >
                Avoid vague words like: fast, should, easy,
                simple, etc., quickly
              </p>

            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {clarifyingQuestions.length > 0 ? (
              <>
                {/* Role Selection */}
                <div className="role-selection">

                  <h3 className="role-title">
                    Select your role for tailored suggestions:
                  </h3>

                  <div className="role-buttons">

                    <button
                      onClick={() => handleRoleSelect('BA')}
                      className={`role-button ba ${
                        selectedRole === 'BA'
                          ? 'selected'
                          : ''
                      }`}
                      disabled={loading}
                    >
                      I'm BA
                    </button>

                    <button
                      onClick={() => handleRoleSelect('DEV')}
                      className={`role-button dev ${
                        selectedRole === 'DEV'
                          ? 'selected'
                          : ''
                      }`}
                      disabled={loading}
                    >
                      I'm DEV
                    </button>

                    <button
                      onClick={() => handleRoleSelect('QA')}
                      className={`role-button qa ${
                        selectedRole === 'QA'
                          ? 'selected'
                          : ''
                      }`}
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

                {/* Action Buttons */}
                <div
                  style={{
                    textAlign: 'center',
                    marginTop: '1.5rem',
                  }}
                >

                  <button
                    onClick={generateAISuggestions}
                    className="refine-button"
                    disabled={!selectedRole || loading}
                  >
                    {loading
                      ? 'Getting AI suggestions...'
                      : 'Refine user story with AI'}
                  </button>

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
              </>
            ) : (
              <>
                {story.trim() !== '' && (
                  <div className="success-message">
                    Great! No vague words detected in your story.
                  </div>
                )}

                <div
                  style={{
                    textAlign: 'center',
                    marginTop: '2rem',
                  }}
                >
                  <button
                    onClick={handleClearStory}
                    className="clear-button"
                    disabled={
                      story.trim() === '' || loading
                    }
                  >
                    Clear Story
                  </button>
                </div>
              </>
            )}
          </>
        )}

      </main>

      {/* =========================
          ACCEPTANCE CRITERIA MODAL
          ========================= */}

      {showACModal && (
        <div
          className="ac-modal-backdrop"
          onClick={handleCloseACModal}
        >

          <div
            className="ac-modal-content"
            onClick={(e) => e.stopPropagation()}
          >

            <div className="ac-modal-header">

              <div className="ac-modal-title">
                Acceptance Criteria
              </div>

              <button
                className="ac-modal-close-button"
                onClick={handleCloseACModal}
              >
                ×
              </button>

            </div>

            <div className="ac-modal-body">

              <div
                className="ac-modal-text"
                dangerouslySetInnerHTML={{
                  __html: modalContent,
                }}
              />

            </div>

            <div className="ac-modal-footer">
              <button
                className="ac-modal-close-button-bottom"
                onClick={handleCloseACModal}
              >
                Close
              </button>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}

export default App;