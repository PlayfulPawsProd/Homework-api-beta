// --- START OF FILE rpg.js ---

// Nyaa~! Mika & Kana's RPG Adventure! Let's go on a Quest, Master! ⚔️✨🎲
// Remember: This is all just pretend! Have fun!

const RpgApp = (() => {
    // --- Settings & Constants ---
    const QUEST_LIBRARY_KEY = 'mikaRpgLibrary_v1';
    const QUEST_CONTEXT_LENGTH = 4; // How many past turns (narrative + action) to send for context
    const MAX_CHOICES_DISPLAYED = 3; // How many choices to show, even if API gives more
    const GENRES = { // Using objects for potential future expansion (e.g., icons)
        'Fantasy': { display: 'Fantasy Kingdom 🏰', promptTerm: 'High Fantasy Kingdom' },
        'SciFi': { display: 'Deep Space Station 🚀', promptTerm: 'Science Fiction Space Station' },
        'Horror': { display: 'Spooky Haunted Mansion 👻', promptTerm: 'Gothic Horror Haunted Mansion' },
        'Cyberpunk': { display: 'Cyberpunk City 🌃', promptTerm: 'Neon-lit Cyberpunk City' },
        'Surprise': { display: 'Surprise Me! 🎲', promptTerm: 'a surprise genre decided by the GM' }
    };
    const ARCHETYPES = {
        'Knight': { display: 'Brave Knight ⚔️', promptTerm: 'a brave Knight' },
        'Wizard': { display: 'Clever Wizard ✨', promptTerm: 'a clever Wizard' },
        'Rogue': { display: 'Sneaky Rogue 🤫', promptTerm: 'a sneaky Rogue' },
        'SpacePilot': { display: 'Daring Space Pilot 🚀', promptTerm: 'a daring Space Pilot' },
        'CyberRunner': { display: 'Tough Cyber-Runner 💻', promptTerm: 'a tough Cyber-Runner' },
        'Adventurer': { display: 'Adventurer 🗺️', promptTerm: 'an Adventurer' } // General default
    };
    const LENGTHS = { // Keys match StoryTime for consistency if needed
        'Short': { display: 'Short (≈4-6 turns)', turns: 5 }, // Approx target turns
        'Medium': { display: 'Medium (≈7-10 turns)', turns: 8 },
        'Long': { display: 'Long (≈11-15 turns)', turns: 13 },
        'Endless': { display: 'Endless~ ☆', turns: Infinity }
    };
    const MAX_LIBRARY_ENTRIES = 30;

    // --- State ---
    let gameUiContainer = null;
    let messageCallback = null; // For non-sensitive system messages outside app UI
    let apiCaller = null;       // Function to call our Gemini API
    let currentUserName = "Adventurer";
    let currentPersonaInGame = 'Mika';

    let questHistory = [];      // Array of { narrative: string, action: string } for current quest
    let gameActive = false;
    let isGenerating = false;   // Prevent simultaneous actions
    let questLibrary = [];      // Array of { title, timestamp, history, persona, outcome, genre, archetype, length }
    let currentView = 'prompt'; // 'prompt', 'quest', 'library', 'detail'
    let currentQuestLengthPreference = 'Medium';
    let currentCharacterArchetype = 'Adventurer';
    let currentGenre = 'Fantasy'; // Default genre

    // --- DOM Element References ---
    let initialPromptArea = null;
    let questDisplayArea = null;
    let questChoicesArea = null;
    let questInputArea = null;
    let questTextInput = null;
    let questSendButton = null;
    let questStatusArea = null;
    let libraryViewArea = null;
    let questDetailViewArea = null;
    let genreSelector = null;
    let archetypeSelector = null;
    let lengthSelector = null;
    let customQuestInput = null;

    // --- Helper Functions ---
    function _getCurrentDateString() { return new Date().toISOString().slice(0, 10); }
    function _formatDateForDisplay(timestamp) {
        if (!timestamp) return 'N/A';
        try { return new Date(timestamp).toLocaleString(); }
        catch (e) { return 'Invalid Date'; }
    }
    function _sanitizeHTML(str) {
        if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) {
            return DOMPurify.sanitize(str, { USE_PROFILES: { html: true }, ALLOWED_TAGS: ['strong', 'em', 'b', 'i', 'p', 'br', 'span', 'div'] });
        }
        console.warn("DOMPurify missing in RPG, basic fallback.");
        return str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // --- Data Persistence ---
    function _loadLibrary() {
        try {
            const stored = localStorage.getItem(QUEST_LIBRARY_KEY);
            if (stored) {
                questLibrary = JSON.parse(stored);
                questLibrary = questLibrary.map(q => ({ ...q, persona: q.persona || 'Mika' }));
                questLibrary.sort((a, b) => b.timestamp - a.timestamp);
                console.log(`Loaded ${questLibrary.length} quests from library.`);
            } else {
                questLibrary = [];
            }
        } catch (e) {
            console.error("Failed to load RPG library:", e);
            questLibrary = [];
            localStorage.removeItem(QUEST_LIBRARY_KEY);
        }
    }

    function _saveLibrary() {
        try {
            if (questLibrary.length > MAX_LIBRARY_ENTRIES) {
                questLibrary.sort((a, b) => b.timestamp - a.timestamp);
                questLibrary = questLibrary.slice(0, MAX_LIBRARY_ENTRIES);
                console.log(`Pruned RPG library to ${MAX_LIBRARY_ENTRIES} entries.`);
            }
            localStorage.setItem(QUEST_LIBRARY_KEY, JSON.stringify(questLibrary));
            console.log(`Saved ${questLibrary.length} quests.`);
        } catch (e) {
            console.error("Failed to save RPG library:", e);
        }
    }

    // --- Core Logic ---

    async function _startGame(customPromptText = null) {
        const selectedGenre = customPromptText ? "Custom" : currentGenre;
        const selectedArchetype = currentCharacterArchetype;
        const selectedLength = currentQuestLengthPreference;

        console.log(`Starting RPG Quest: Genre=${selectedGenre}, Archetype=${selectedArchetype}, Length=${selectedLength}`);
        _createGameLayout();
        gameActive = true;
        isGenerating = true;
        _setLoadingState(true);
        questHistory = [];

        const archetypeTerm = ARCHETYPES[selectedArchetype]?.promptTerm || 'an Adventurer';
        let startingScenario;
        if (customPromptText) {
            startingScenario = `based on this idea from ${currentUserName}: "${customPromptText}". Make sure the quest has a clear goal.`;
            currentGenre = "Custom"; // Set genre state for saving later
        } else {
            const genreTerm = GENRES[selectedGenre]?.promptTerm || 'a fantasy setting';
            startingScenario = `in ${genreTerm}. Create a clear quest goal for them.`;
            currentGenre = selectedGenre; // Set genre state
        }

        const initialPrompt = `[ROLE: You are ${currentPersonaInGame}, the Game Master!] Start an interactive RPG quest for ${currentUserName}, who is playing as ${archetypeTerm}, ${startingScenario}. Describe the opening scene vividly (2 paragraphs) and present the main quest goal clearly. End by giving ${currentUserName} exactly ${MAX_CHOICES_DISPLAYED} distinct action choices as a numbered list (e.g., '1. Choice one').`;

        _appendNarrative(`**(GM ${currentPersonaInGame} is preparing the adventure...)**`, 'system-gamemsg');

        try {
            const responseText = await callMikaApiForApp(initialPrompt);

            if (responseText) {
                const { narrative, choices, questEnded } = _parseGmResponse(responseText);
                _clearDisplayArea();
                if (narrative) {
                    questHistory.push({ narrative: narrative, action: "[Start]" });
                    _appendNarrative(narrative);
                    if (!questEnded && choices.length > 0) {
                        _displayChoices(choices);
                    } else {
                        _appendNarrative(`GM: Hmm, the adventure ended before it began! Maybe try a different setup?`);
                        _showRestartButton();
                        gameActive = false;
                    }
                } else {
                     _appendNarrative("GM: Meeeow! My imagination is fuzzy... Couldn't start the quest. Try again?");
                     _showRestartButton();
                     gameActive = false;
                }
            } else {
                _clearDisplayArea();
                _appendNarrative(`GM: ${currentPersonaInGame === 'Kana' ? 'Failed to generate quest start.' : 'Mrow! Couldn\'t get the adventure started... API error?'} Try again?`);
                _showRestartButton();
                gameActive = false;
            }
        } catch (error) {
             _clearDisplayArea();
             console.error("Error starting RPG quest:", error);
             _appendNarrative(`GM: *Hiss!* Something went wrong starting the quest! (${error}). Try again?`);
             _showRestartButton();
             gameActive = false;
        } finally {
            isGenerating = false;
            _setLoadingState(false);
        }
    }

    function _startCustomQuest() {
        if (!customQuestInput || isGenerating) return;
        const customText = customQuestInput.value.trim();
        if (!customText) {
            messageCallback('System', `${currentPersonaInGame === 'Kana' ? 'Type something first.' : 'Nyaa~ Tell me your idea first!'}`);
            customQuestInput.placeholder = "Please enter an idea first!";
            customQuestInput.focus();
            return;
        }
        _startGame(customText);
    }


    async function _handleUserAction(actionText) {
        if (!gameActive || isGenerating) return;

        const lowerCaseAction = actionText.toLowerCase().trim();
        if (lowerCaseAction === 'end') {
            _appendUserActionToQuest(actionText);
            _appendNarrative(`GM: You decided to end the quest here. Adventure awaits another day!`);
            gameActive = false;
            await _saveCompletedQuest('Ended');
            _showRestartButton();
            if (questInputArea) questInputArea.style.display = 'none';
            return;
        }

        console.log(`User action (Turn ${questHistory.length}): ${actionText}`);
        _appendUserActionToQuest(actionText);
        if (questTextInput) questTextInput.value = '';
        _displayChoices([]);

        isGenerating = true;
        _setLoadingState(true);

        const contextTurns = questHistory.slice(-QUEST_CONTEXT_LENGTH);
        const apiContext = contextTurns
            // .filter(turn => turn.action !== "[Start]") // Filter removed in previous attempts, keep it removed
            .flatMap(turn => [
                { role: 'model', parts: [{ text: turn.narrative }] },
                { role: 'user', parts: [{ text: turn.action }] }
            ]);

        const turnCount = questHistory.length;
        const targetTurns = LENGTHS[currentQuestLengthPreference]?.turns || Infinity;
        let lengthNudge = "";
        if (targetTurns !== Infinity && turnCount >= targetTurns - 1 ) {
            lengthNudge = ` IMPORTANT: The player prefers a '${currentQuestLengthPreference}' length quest (around ${targetTurns} turns). This is turn ${turnCount}. Guide the narrative towards a conclusion based on their action. If the action naturally leads to the end (success or failure), describe it and write '(Quest Complete)' or '(Quest Failed)' on a new line after the description, instead of offering choices.`;
        }

        const prompt = `[ROLE: You are ${currentPersonaInGame}, the Game Master!] Continue the interactive RPG based on the recent history provided in the context. The player is ${currentUserName} (${ARCHETYPES[currentCharacterArchetype]?.promptTerm}). Their latest action was: "${actionText}".\n\nDescribe what happens next (1-2 paragraphs) in the ${GENRES[currentGenre]?.promptTerm || 'chosen'} setting, maintaining your ${currentPersonaInGame} GM personality. Determine success/failure/consequences narratively based on the action and situation.${lengthNudge} Unless the quest is ending (due to the action or length guidance), give ${currentUserName} exactly ${MAX_CHOICES_DISPLAYED} new, distinct action choices as a numbered list (e.g., '1. Choice one'). Ensure choices make sense. If ending, use '(Quest Complete)' or '(Quest Failed)' markers.`;

        try {
            const responseText = await callMikaApiForApp(prompt, apiContext);

            if (responseText) {
                 const { narrative, choices, questEnded, outcome } = _parseGmResponse(responseText); // Use the refined parser

                 if (narrative) {
                     questHistory.push({ narrative: narrative, action: actionText });
                     _appendNarrative(narrative);

                     if (questEnded) {
                         _appendNarrative(`GM: ${outcome === 'Failed' ? 'Quest Failed...' : 'Quest Complete!'} ${currentPersonaInGame === 'Mika' ? 'Nyaa~!' : '.'}`);
                         gameActive = false;
                         await _saveCompletedQuest(outcome);
                         _showRestartButton();
                         if (questInputArea) questInputArea.style.display = 'none';
                     } else if (choices.length > 0) {
                         _displayChoices(choices);
                     } else {
                          _appendNarrative("GM: ...Hmm, I seem to have run out of ideas for choices! Where do we go from here? Maybe type 'end' or try something specific?");
                          _displayChoices([]); // Ensure choices are cleared if none provided
                     }
                 } else {
                     _appendNarrative(`GM: ${currentPersonaInGame === 'Kana' ? 'My response was garbled.' : 'Meeeow! My crystal ball is fuzzy...'} Try again?`);
                     _displayChoices([]);
                 }

            } else {
                 _appendNarrative(`GM: ${currentPersonaInGame === 'Kana' ? 'Connection error or empty response.' : 'Mrow! Couldn\'t reach the adventure realm...'} Try again?`);
                 _displayChoices(currentChoices); // Re-show previous choices on error
            }
        } catch (error) {
            console.error("Error processing RPG turn:", error);
            _appendNarrative(`GM: *Hiss!* My GM powers fizzled! Error: ${error}. Try again?`);
            _displayChoices(currentChoices); // Re-show previous choices on error
        } finally {
            isGenerating = false;
            _setLoadingState(false);
        }
    }

    // *** UPDATED _parseGmResponse function ***
    function _parseGmResponse(responseText) {
        let fullText = responseText || "";
        let narrative = fullText; // Start assuming the whole thing is narrative
        let choices = [];
        let questEnded = false;
        let outcome = null;

        const endCompleteMarker = "(Quest Complete)";
        const endFailedMarker = "(Quest Failed)";

        // 1. Check for explicit end markers first and remove them
        if (narrative.includes(endCompleteMarker)) {
            questEnded = true;
            outcome = 'Complete';
            narrative = narrative.replace(endCompleteMarker, "").trim();
            fullText = narrative; // Update fullText too
        } else if (narrative.includes(endFailedMarker)) {
            questEnded = true;
            outcome = 'Failed';
            narrative = narrative.replace(endFailedMarker, "").trim();
            fullText = narrative; // Update fullText too
        }

        // 2. If the quest hasn't explicitly ended, look for choices
        if (!questEnded) {
            const lines = fullText.split('\n');
            let potentialChoices = [];
            let firstChoiceLineIndex = -1;
            let lastChoiceLineIndex = -1;

            // Find the start of the *last block* of numbered/bulleted choices
            for (let i = lines.length - 1; i >= 0; i--) {
                const line = lines[i].trim();
                // Check for numbered (1.) or bulleted (* or -) list items
                if (/^(\d+\.|[\*\-]\s)/.test(line)) {
                     const choiceText = line.replace(/^(\d+\.|[\*\-]\s)\s*/, '').trim();
                     if (choiceText) {
                         potentialChoices.unshift(choiceText);
                         if (lastChoiceLineIndex === -1) { lastChoiceLineIndex = i; }
                         firstChoiceLineIndex = i;
                     }
                 } else if (potentialChoices.length > 0 && line !== "") {
                     break; // Hit non-empty, non-choice after choices found
                 } else if (line === "") {
                     if (potentialChoices.length === 0) { /* Ignore empty lines before choices */ }
                 } else {
                    break; // Hit non-empty, non-choice before any choices found
                 }
            }

            // 3. If choices were found, separate narrative and choices
            if (potentialChoices.length > 0 && firstChoiceLineIndex !== -1) {
                // Narrative is everything BEFORE the first choice line
                let narrativePart = lines.slice(0, firstChoiceLineIndex).join('\n').trim();

                // Text AFTER choices is everything from the line AFTER the last choice line
                let postChoiceText = "";
                if (lastChoiceLineIndex < lines.length - 1) {
                    postChoiceText = lines.slice(lastChoiceLineIndex + 1).join('\n').trim();
                }

                // Combine narrative + post-choice text (if any and seems like narrative)
                narrative = narrativePart;
                if (postChoiceText && !(/^\d+\.\s+|[\*\-]\s/.test(postChoiceText))) { // Append if not more choices
                    narrative += (narrative ? "\n\n" : "") + postChoiceText;
                }

                choices = potentialChoices.slice(0, MAX_CHOICES_DISPLAYED);

                if (!narrative) { narrative = "(Choose your next action...)"; }

            } else {
                // No choices found, the whole thing is narrative
                narrative = fullText.trim();
                choices = [];
            }
        } else {
             // Quest ended explicitly, ensure no choices are returned
             choices = [];
             narrative = fullText.trim();
             if (!narrative) narrative = `(The quest reached its conclusion: ${outcome})`;
        }

        // Final trim just in case
        narrative = narrative.trim();

        return { narrative, choices, questEnded, outcome };
    }


     async function _generateQuestTitle(history) {
         if (!apiCaller || !history || history.length === 0) return null;
         console.log("Attempting to generate quest title..."); // Add log

         const firstNarrative = history[0]?.narrative.substring(0, 150) || "An adventure";
         const lastAction = history.length > 1 ? history[history.length - 1]?.action.substring(0,50) : "the beginning";
         const prompt = `[ROLE: You are a creative writer.] Generate a short, catchy title (4-8 words max) for an RPG quest that started like: "${firstNarrative}..." and involved the player action "${lastAction}". Output only the title text, no extra characters or quotes.`;

         try {
             const titleResponse = await callMikaApiForApp(prompt, []);
             if(titleResponse) {
                 let cleanTitle = titleResponse.replace(/["'*]/g, '').trim();
                 cleanTitle = cleanTitle.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                 if (cleanTitle.length > 0 && cleanTitle.length < 80) {
                     console.log("Generated quest title:", cleanTitle);
                     return cleanTitle;
                 }
             }
             console.warn("Generated title was invalid or empty:", titleResponse);
         } catch(error) {
             console.error("API call for quest title failed:", error);
         }
         // Fallback
         return `Quest: ${lastAction}...`;
     }


    async function _saveCompletedQuest(outcome) {
        if (!questHistory || questHistory.length === 0) return;
        console.log("Saving completed quest. Outcome:", outcome);
        let title = `A ${currentGenre} Quest (${_getCurrentDateString()})`;

        try {
            const generatedTitle = await _generateQuestTitle([...questHistory]);
            if (generatedTitle) { title = generatedTitle; }
        } catch(error) { console.error("Error generating quest title:", error); }

        const questLog = {
            title: title, timestamp: Date.now(), history: [...questHistory],
            persona: currentPersonaInGame, outcome: outcome || 'Ended',
            genre: currentGenre, archetype: currentCharacterArchetype, length: currentQuestLengthPreference
        };
        questLibrary.push(questLog);
        _saveLibrary();
        if(messageCallback) messageCallback('System', `Quest "${title}" saved to log!`);
    }

    // --- UI Rendering Functions ---
    function _clearGameContainer() { if (gameUiContainer) gameUiContainer.innerHTML = ''; initialPromptArea = questDisplayArea = questChoicesArea = questInputArea = questTextInput = questSendButton = questStatusArea = libraryViewArea = questDetailViewArea = genreSelector = archetypeSelector = lengthSelector = customQuestInput = null; }
    function _clearDisplayArea() { if(questDisplayArea) questDisplayArea.innerHTML = ''; }

    function _createInitialUI() {
        _clearGameContainer(); currentView = 'prompt'; gameActive = false;
        initialPromptArea = document.createElement('div'); initialPromptArea.id = 'rpg-initial-prompt'; initialPromptArea.style.cssText = `text-align: center; padding: 15px; display: flex; flex-direction: column; align-items: center; height: 100%; box-sizing: border-box; overflow-y: auto;`;
        const title = document.createElement('h3'); title.textContent = `Let's Go on an Adventure, ${currentUserName}!`; title.style.color = 'var(--chat-header-text)'; initialPromptArea.appendChild(title);
        const setupGrid = document.createElement('div'); setupGrid.style.display = 'grid'; setupGrid.style.gridTemplateColumns = 'auto 1fr'; setupGrid.style.gap = '10px 5px'; setupGrid.style.alignItems = 'center'; setupGrid.style.margin = '15px 0'; setupGrid.style.maxWidth = '400px';
        const genreLabel = document.createElement('label'); genreLabel.textContent = 'Setting: '; genreLabel.style.textAlign = 'right';
        genreSelector = document.createElement('select'); Object.entries(GENRES).forEach(([key, data]) => { const option = document.createElement('option'); option.value = key; option.textContent = data.display; if (key === currentGenre) option.selected = true; genreSelector.appendChild(option); }); genreSelector.onchange = (e) => { currentGenre = e.target.value; }; setupGrid.appendChild(genreLabel); setupGrid.appendChild(genreSelector);
        const archetypeLabel = document.createElement('label'); archetypeLabel.textContent = 'Your Role: '; archetypeLabel.style.textAlign = 'right';
        archetypeSelector = document.createElement('select'); Object.entries(ARCHETYPES).forEach(([key, data]) => { const option = document.createElement('option'); option.value = key; option.textContent = data.display; if (key === currentCharacterArchetype) option.selected = true; archetypeSelector.appendChild(option); }); archetypeSelector.onchange = (e) => { currentCharacterArchetype = e.target.value; }; setupGrid.appendChild(archetypeLabel); setupGrid.appendChild(archetypeSelector);
        const lengthLabel = document.createElement('label'); lengthLabel.textContent = 'Quest Length: '; lengthLabel.style.textAlign = 'right';
        lengthSelector = document.createElement('select'); Object.entries(LENGTHS).forEach(([key, data]) => { const option = document.createElement('option'); option.value = key; option.textContent = data.display; if (key === currentQuestLengthPreference) option.selected = true; lengthSelector.appendChild(option); }); lengthSelector.onchange = (e) => { currentQuestLengthPreference = e.target.value; }; setupGrid.appendChild(lengthLabel); setupGrid.appendChild(lengthSelector);
        initialPromptArea.appendChild(setupGrid);
        const startButton = document.createElement('button'); startButton.textContent = 'Start Selected Quest!'; startButton.className = 'rps-choice-button'; startButton.style.marginTop = '10px'; startButton.onclick = () => _startGame(); initialPromptArea.appendChild(startButton);
        const customArea = document.createElement('div'); customArea.style.marginTop = '20px'; customArea.style.width = '100%'; customArea.style.maxWidth = '450px';
        const customLabel = document.createElement('p'); customLabel.textContent = 'Or Describe Your Own Quest Idea:'; customLabel.style.marginBottom = '5px'; customQuestInput = document.createElement('input'); customQuestInput.type = 'text'; customQuestInput.placeholder = 'e.g., Find a lost kitten in a magical forest'; customQuestInput.style.cssText = `width: 100%; padding: 8px; box-sizing: border-box; margin-bottom: 5px; background-color: var(--input-bg); color: var(--text-color); border: 1px solid var(--input-border); border-radius: 4px;`; const customStartButton = document.createElement('button'); customStartButton.textContent = 'Start Custom Quest!'; customStartButton.className = 'rps-choice-button secondary'; customStartButton.onclick = _startCustomQuest; customArea.appendChild(customLabel); customArea.appendChild(customQuestInput); customArea.appendChild(customStartButton); initialPromptArea.appendChild(customArea);
        const libraryButton = document.createElement('button'); libraryButton.textContent = 'View Quest Log 📚'; libraryButton.className = 'rps-choice-button secondary'; libraryButton.style.marginTop = '25px'; libraryButton.onclick = _createLibraryUI; initialPromptArea.appendChild(libraryButton);
        const backBtn = document.createElement('button'); backBtn.id = 'back-to-chat-button'; backBtn.textContent = 'Back to Chat'; backBtn.className = 'rps-choice-button secondary'; backBtn.style.marginTop = '10px'; backBtn.onclick = () => { if (typeof switchToChatView === 'function') switchToChatView(); }; initialPromptArea.appendChild(backBtn);
        gameUiContainer.appendChild(initialPromptArea);
        [genreSelector, archetypeSelector, lengthSelector].forEach(sel => { if(sel) { sel.style.padding = '5px'; sel.style.borderRadius = '4px'; sel.style.backgroundColor = 'var(--input-bg)'; sel.style.color = 'var(--text-color)'; sel.style.border = '1px solid var(--input-border)'; } });
    }

    function _createGameLayout() {
        _clearGameContainer(); currentView = 'quest';
        const questWrapper = document.createElement('div'); questWrapper.id = 'story-wrapper'; questWrapper.style.cssText = `display: flex; flex-direction: column; height: 100%; width: 100%; box-sizing: border-box;`;
        questDisplayArea = document.createElement('div'); questDisplayArea.id = 'quest-display-area'; questDisplayArea.className = 'story-display-area'; questWrapper.appendChild(questDisplayArea);
        questStatusArea = document.createElement('div'); questStatusArea.id = 'quest-status-area'; questStatusArea.className = 'story-status-area'; questWrapper.appendChild(questStatusArea);
        const interactionArea = document.createElement('div'); interactionArea.id = 'quest-interaction-area'; interactionArea.className = 'story-interaction-area';
        questChoicesArea = document.createElement('div'); questChoicesArea.id = 'quest-choices-area'; questChoicesArea.className = 'story-choices-area'; interactionArea.appendChild(questChoicesArea);
        questInputArea = document.createElement('div'); questInputArea.id = 'quest-input-area'; questInputArea.className = 'story-input-area';
        questTextInput = document.createElement('input'); questTextInput.type = 'text'; questTextInput.placeholder = 'Type your action... (or "end" to quit)'; questTextInput.className = 'story-text-input'; questTextInput.onkeypress = (e) => { if (e.key === 'Enter' && gameActive && !isGenerating && questTextInput.value.trim()) { e.preventDefault(); _handleUserAction(questTextInput.value.trim()); } };
        questSendButton = document.createElement('button'); questSendButton.textContent = 'Do It!'; questSendButton.className = 'story-send-button rps-choice-button'; questSendButton.onclick = () => { if (gameActive && !isGenerating && questTextInput.value.trim()) { _handleUserAction(questTextInput.value.trim()); } };
        questInputArea.appendChild(questTextInput); questInputArea.appendChild(questSendButton); interactionArea.appendChild(questInputArea); questWrapper.appendChild(interactionArea); gameUiContainer.appendChild(questWrapper);
    }

    function _appendNarrative(text, cssClass = null) { if (!questDisplayArea) return; const paragraph = document.createElement('p'); if (cssClass) paragraph.className = cssClass; if (cssClass !== 'user-action') { let processedText = _sanitizeHTML(text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/(?<!<br>)\n/g, '<br>'); paragraph.innerHTML = `<strong>${currentPersonaInGame} (GM):</strong> ${processedText}`; } else { paragraph.innerHTML = text; } questDisplayArea.appendChild(paragraph); setTimeout(() => { if (questDisplayArea) questDisplayArea.scrollTop = questDisplayArea.scrollHeight; }, 50); }
    function _appendUserActionToQuest(actionText) { if (!questDisplayArea) return; const sanitizedAction = _sanitizeHTML(actionText); const formattedText = `> ${currentUserName}: ${sanitizedAction}`; _appendNarrative(formattedText, 'user-action'); }
    function _displayChoices(choices) {
        if (!questChoicesArea) return; questChoicesArea.innerHTML = ''; if (!choices || choices.length === 0) { return; } currentChoices = choices;
        choices.forEach((choiceText, index) => { const button = document.createElement('button'); const cleanChoiceText = choiceText.replace(/^[\*\-\d]+\.?\s*/, '').trim(); button.className = 'rps-choice-button story-choice'; button.onclick = () => _handleUserAction(cleanChoiceText); const textSpan = document.createElement('span'); textSpan.textContent = `${index + 1}. ${cleanChoiceText}`; textSpan.className = 'scrollable-text'; button.appendChild(textSpan); questChoicesArea.appendChild(button); requestAnimationFrame(() => { if (!button.isConnected) return; const computedStyle = window.getComputedStyle(button); const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0; const paddingRight = parseFloat(computedStyle.paddingRight) || 0; const availableWidth = button.clientWidth - paddingLeft - paddingRight; const textWidth = textSpan.scrollWidth; if (textWidth > availableWidth + 1) { button.classList.add('text-overflow-scroll'); const scrollDistance = availableWidth - textWidth; button.style.setProperty('--scroll-distance', `${scrollDistance - 5}px`); const overflowAmount = textWidth - availableWidth; const baseDuration = 6; const extraPerPixel = 0.06; let duration = Math.max(6, baseDuration + overflowAmount * extraPerPixel); duration = Math.min(duration, 25); textSpan.style.animationDuration = `${duration.toFixed(1)}s`; button.title = cleanChoiceText; } else { button.classList.remove('text-overflow-scroll'); button.title = ''; button.style.removeProperty('--scroll-distance'); textSpan.style.animationDuration = ''; } }); });
    }
    function _setLoadingState(isLoading) { isGenerating = isLoading; if (questTextInput) questTextInput.disabled = isLoading; if (questSendButton) questSendButton.disabled = isLoading; if (questChoicesArea) questChoicesArea.querySelectorAll('button').forEach(button => button.disabled = isLoading); if (initialPromptArea) initialPromptArea.querySelectorAll('button, select, input').forEach(el => el.disabled = isLoading); if (questStatusArea) { if (isLoading) { questStatusArea.textContent = isLoading ? (currentPersonaInGame === 'Kana' ? 'Calculating fate...' : 'GM is thinking... *rolls dice*') : ''; questStatusArea.style.display = 'block'; questStatusArea.style.color = 'var(--typing-indicator-text)'; questStatusArea.style.fontWeight = 'normal'; } else { if (gameActive && questHistory.length > 0) { questStatusArea.textContent = `Turn: ${questHistory.length}`; questStatusArea.style.display = 'block'; questStatusArea.style.color = 'var(--system-message-text)'; questStatusArea.style.fontWeight = 'bold'; } else { questStatusArea.textContent = ''; questStatusArea.style.display = 'none'; } } } }
    function _showRestartButton(buttonText = null) { const interactionArea = document.getElementById('quest-interaction-area'); if (interactionArea) { if (questChoicesArea) questChoicesArea.innerHTML = ''; if (questInputArea) questInputArea.style.display = 'none'; const container = document.createElement('div'); container.style.textAlign = 'center'; container.style.marginTop = '15px'; const newQuestBtn = document.createElement('button'); newQuestBtn.textContent = buttonText || (currentPersonaInGame === 'Kana' ? "New Quest." : "New Quest? ♡"); newQuestBtn.className = 'rps-choice-button'; newQuestBtn.style.marginRight = '10px'; newQuestBtn.onclick = _createInitialUI; container.appendChild(newQuestBtn); const backBtn = document.createElement('button'); backBtn.id = 'back-to-chat-button'; backBtn.textContent = 'Back to Chat'; backBtn.className = 'rps-choice-button secondary'; backBtn.onclick = () => { if (typeof switchToChatView === 'function') switchToChatView(); }; container.appendChild(backBtn); if(questChoicesArea) { questChoicesArea.appendChild(container); } else { interactionArea.appendChild(container); } } }

    // --- Library UI Functions ---
    function _createLibraryUI() { _clearGameContainer(); currentView = 'library'; libraryViewArea = document.createElement('div'); libraryViewArea.className = 'library-view'; const title = document.createElement('h2'); title.textContent = 'Quest Log 📚'; title.className = 'library-title'; libraryViewArea.appendChild(title); const backButton = document.createElement('button'); backButton.textContent = '← Back to Quest Setup'; backButton.className = 'rps-choice-button secondary library-back-button'; backButton.onclick = _createInitialUI; libraryViewArea.appendChild(backButton); const listContainer = document.createElement('div'); listContainer.id = 'quest-library-list-container'; libraryViewArea.appendChild(listContainer); gameUiContainer.appendChild(libraryViewArea); _renderLibraryList(listContainer); }
    function _renderLibraryList(container) { container.innerHTML = ''; if (questLibrary.length === 0) { container.innerHTML = `<p style="text-align: center; font-style: italic; color: var(--system-message-text);">No quests recorded yet. Go have an adventure!</p>`; return; } questLibrary.forEach((quest, index) => { const itemDiv = document.createElement('div'); itemDiv.className = 'library-item'; itemDiv.onclick = () => _createQuestDetailView(index); const titleSpan = document.createElement('span'); titleSpan.className = 'library-item-title'; titleSpan.textContent = `${quest.title || `Quest ${questLibrary.length - index}`}`; if (quest.outcome === 'Complete') titleSpan.textContent += ' (✔️)'; else if (quest.outcome === 'Failed') titleSpan.textContent += ' (❌)'; else titleSpan.textContent += ' (?)'; itemDiv.appendChild(titleSpan); const dateSpan = document.createElement('span'); dateSpan.className = 'library-item-date'; const genreDisplay = GENRES[quest.genre]?.display || quest.genre || 'Unknown Genre'; const archetypeDisplay = ARCHETYPES[quest.archetype]?.display || quest.archetype || 'Unknown Role'; dateSpan.textContent = `${genreDisplay} | ${archetypeDisplay} | GM: ${quest.persona} | ${_formatDateForDisplay(quest.timestamp)}`; itemDiv.appendChild(dateSpan); container.appendChild(itemDiv); }); }
    function _createQuestDetailView(questIndex) { _clearGameContainer(); currentView = 'detail'; const quest = questLibrary[questIndex]; if (!quest) { console.error(`Quest with index ${questIndex} not found.`); _createLibraryUI(); return; } const writerPersona = quest.persona || 'Mika'; questDetailViewArea = document.createElement('div'); questDetailViewArea.className = 'story-detail-view'; const title = document.createElement('h3'); title.textContent = quest.title || `Quest ${questLibrary.length - questIndex}`; questDetailViewArea.appendChild(title); const outcomeText = document.createElement('p'); outcomeText.style.textAlign = 'center'; outcomeText.style.fontWeight = 'bold'; if (quest.outcome === 'Complete') { outcomeText.textContent = 'Outcome: Success! ✔️'; outcomeText.style.color = 'lightgreen'; } else if (quest.outcome === 'Failed') { outcomeText.textContent = 'Outcome: Failed! ❌'; outcomeText.style.color = 'var(--error-color)'; } else { outcomeText.textContent = 'Outcome: Ended (?)'; outcomeText.style.color = 'var(--system-message-text)'; } questDetailViewArea.appendChild(outcomeText); const backButton = document.createElement('button'); backButton.textContent = '← Back to Quest Log'; backButton.className = 'rps-choice-button secondary library-back-button'; backButton.onclick = _createLibraryUI; questDetailViewArea.appendChild(backButton); quest.history.forEach(turn => { if (turn.action === "[Start]") { const narrativeP = document.createElement('p'); let processedText = _sanitizeHTML(turn.narrative).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/(?<!<br>)\n/g, '<br>'); narrativeP.innerHTML = `<strong>${writerPersona} (GM):</strong> ${processedText}`; questDetailViewArea.appendChild(narrativeP); } else { const actionP = document.createElement('p'); actionP.className = 'detail-user-action'; actionP.innerHTML = `> ${currentUserName}: ${_sanitizeHTML(turn.action)}`; questDetailViewArea.appendChild(actionP); const narrativeP = document.createElement('p'); let processedText = _sanitizeHTML(turn.narrative).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/(?<!<br>)\n/g, '<br>'); narrativeP.innerHTML = `<strong>${writerPersona} (GM):</strong> ${processedText}`; questDetailViewArea.appendChild(narrativeP); } }); gameUiContainer.appendChild(questDetailViewArea); if (questDetailViewArea) questDetailViewArea.scrollTop = 0; }

    // --- Initialization and Exit ---
    function init(_gameUiContainer, _messageCallback, _apiCaller, userName, persona) { console.log("Initializing RPG Adventure App..."); gameUiContainer = _gameUiContainer; messageCallback = _messageCallback; apiCaller = _apiCaller; currentUserName = userName || "Adventurer"; currentPersonaInGame = persona || 'Mika'; isGenerating = false; if (!gameUiContainer) { console.error("RPG App UI container not provided!"); if(messageCallback) messageCallback('System', 'Error: RPG App UI container missing!'); return; } _loadLibrary(); _createInitialUI(); console.log(`RPG App initialized for ${currentUserName} with GM ${currentPersonaInGame}.`); }
    function onExit() { console.log("RpgApp onExit called."); questHistory = []; gameActive = false; isGenerating = false; currentView = 'prompt'; return Promise.resolve(true); }

    // --- Public Interface ---
    return { init: init, onExit: onExit };

})();

// --- END OF FILE rpg.js ---