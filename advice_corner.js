// --- START OF FILE advice_corner.js ---

// Nyaa~! Mika & Kana's Advice Corner! Tell me everything! ♡ (Or... complain, whatever. - Kana)

const AdviceCorner = (() => {
    // --- Settings & Constants ---
    const LIBRARY_STORAGE_KEY = 'mikaAdviceLog_v1';
    const MAX_LIBRARY_ENTRIES = 30;
    const MAX_SESSION_HISTORY = 50; // Limit turns stored for unsaved session
    const MESSAGE_BUBBLE_DURATION_MS = 5000; // How long the bubble stays visible
    const MIKA_COLORS = { body: '#ffc1e3', accent: '#f48fb1', eyes: '#222' };
    const KANA_COLORS = { body: '#5c546d', accent: '#423d51', eyes: '#111' };

    // --- State ---
    let gameUiContainer = null;
    let messageCallback = null;
    let apiCaller = null;
    let currentUserName = "User";
    let currentPersonaInGame = 'Mika';

    let adviceHistory = [];      // Array of { sender: 'User'/'Mika'/'Kana', text: string } for the current session.
    let adviceLibrary = [];      // Array of { title, timestamp, history, persona } for saved sessions.
    let isGenerating = false;    // Prevent simultaneous API calls.
    let sessionActive = false;   // Is the character "IN" and accepting input?
    let currentView = 'corner';  // 'corner', 'current_session', 'library_list', 'library_detail'

    // --- DOM Element References ---
    let adviceCornerView = null;
    let characterGraphicContainer = null; // Holds the character graphic
    let boothContainer = null; // Holds the booth elements
    let boothSignInOut = null; // The 'IN'/'OUT' sign text element
    let adviceMessageBubble = null; // Floating text bubble
    let adviceInputArea = null;
    let adviceTextInput = null;
    let adviceSendButton = null;
    let controlsArea = null; // For buttons like View History, New Session
    let viewCurrentSessionButton = null;
    let viewLibraryButton = null;
    let newSessionButton = null;
    let backToChatButton = null; // Main back button
    let statusArea = null; // For "Thinking..." messages

    // Character parts (for animation/styling)
    let charBody = null, charEarLeft = null, charEarRight = null, charEyeLeft = null, charEyeRight = null, charTail = null;
    let bounceAnimation = null; // To store character animation

    // --- Helper Functions ---
    function _getCurrentTimestamp() { return Date.now(); }
    function _formatDateForDisplay(timestamp) { if (!timestamp) return 'N/A'; try { return new Date(timestamp).toLocaleString(); } catch (e) { return 'Invalid Date'; } }
    function _sanitizeHTML(str) { if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) { return DOMPurify.sanitize(str, { USE_PROFILES: { html: true }, ALLOWED_TAGS: ['strong', 'em', 'b', 'i', 'br'] }); } console.warn("DOMPurify missing in AdviceCorner, basic fallback."); return str.replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    // --- Library Persistence ---
    function _loadLibrary() {
        try {
            const stored = localStorage.getItem(LIBRARY_STORAGE_KEY);
            if (stored) {
                adviceLibrary = JSON.parse(stored);
                adviceLibrary = adviceLibrary.map(log => ({ ...log, persona: log.persona || 'Mika' })); // Add default persona if missing
                adviceLibrary.sort((a, b) => b.timestamp - a.timestamp); // Sort newest first
                console.log(`Loaded ${adviceLibrary.length} advice sessions.`);
            } else { adviceLibrary = []; }
        } catch (e) { console.error("Failed to load advice library:", e); adviceLibrary = []; localStorage.removeItem(LIBRARY_STORAGE_KEY); }
    }

    function _saveLibrary() {
        try {
            if (adviceLibrary.length > MAX_LIBRARY_ENTRIES) {
                adviceLibrary.sort((a, b) => b.timestamp - a.timestamp); // Ensure newest are kept
                adviceLibrary = adviceLibrary.slice(0, MAX_LIBRARY_ENTRIES);
                console.log(`Pruned advice library to ${MAX_LIBRARY_ENTRIES} entries.`);
            }
            localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(adviceLibrary));
            console.log(`Saved ${adviceLibrary.length} advice sessions.`);
        } catch (e) { console.error("Failed to save advice library:", e); }
    }

    // --- UI Creation ---
    function _clearUI() {
        if (gameUiContainer) gameUiContainer.innerHTML = '';
        // Reset all DOM references
        adviceCornerView = characterGraphicContainer = boothContainer = boothSignInOut = adviceMessageBubble = adviceInputArea = adviceTextInput = adviceSendButton = controlsArea = viewCurrentSessionButton = viewLibraryButton = newSessionButton = backToChatButton = statusArea = null;
        charBody = charEarLeft = charEarRight = charEyeLeft = charEyeRight = charTail = null;
        if (bounceAnimation) bounceAnimation.cancel(); bounceAnimation = null;
        currentView = 'corner'; // Reset view state
    }

    function _createMainUI() {
        _clearUI();
        currentView = 'corner';

        adviceCornerView = document.createElement('div');
        adviceCornerView.id = 'advice-corner-view';
        adviceCornerView.style.cssText = `width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 10px; box-sizing: border-box; position: relative; overflow: hidden;`;

        // Status Area (for loading messages)
        statusArea = document.createElement('div');
        statusArea.id = 'advice-status-area';
        statusArea.style.cssText = `position: absolute; top: 5px; left: 50%; transform: translateX(-50%); font-style: italic; color: var(--typing-indicator-text); z-index: 5; background: rgba(0,0,0,0.5); padding: 2px 8px; border-radius: 5px; display: none; font-size: 0.9em;`;
        adviceCornerView.appendChild(statusArea);

        // Top section for Booth and Character
        const topSection = document.createElement('div');
        topSection.style.cssText = `position: relative; width: 100%; display: flex; justify-content: center; align-items: flex-end; flex-grow: 1; min-height: 250px; /* Ensure space */`; // Align items to bottom for booth effect

        // Create Booth Structure
        boothContainer = _createBoothGraphic();
        topSection.appendChild(boothContainer);

        // Create Character Graphic inside the booth
        characterGraphicContainer = _createCharacterGraphic();
        // Position character slightly above the counter visually
        characterGraphicContainer.style.position = 'absolute';
        characterGraphicContainer.style.bottom = '25px'; // Adjust as needed based on booth graphic height
        characterGraphicContainer.style.zIndex = '1'; // Behind counter visually? Or 3 if in front
        topSection.appendChild(characterGraphicContainer);

        // Create Floating Message Bubble (initially hidden)
        adviceMessageBubble = document.createElement('div');
        adviceMessageBubble.id = 'advice-message-bubble';
        // Reuse Gotchi styling, but position relative to character area
        adviceMessageBubble.style.cssText = `
            position: absolute;
            bottom: 130px; /* Adjust starting position above character */
            left: 50%;
            transform: translateX(-50%);
            color: var(--mika-message-name, #f06292);
            font-weight: bold; padding: 8px 12px; font-size: 1em; text-align: center;
            opacity: 0; transition: opacity 0.4s ease-in-out, bottom 0.4s ease-in-out; /* Smooth fade and slight rise */
            z-index: 4; max-width: 80%; white-space: normal; pointer-events: none;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
            background: rgba(var(--chat-input-bg-rgb, 26, 26, 46), 0.85); /* Use input background with alpha */
            border: 1px solid var(--chat-input-border);
            border-radius: 10px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            backdrop-filter: blur(3px);
        `;
        topSection.appendChild(adviceMessageBubble); // Add to top section for positioning

        adviceCornerView.appendChild(topSection);

        // Bottom section for Input and Controls
        const bottomSection = document.createElement('div');
        bottomSection.style.cssText = `width: 100%; max-width: 450px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center;`;

        // Input Area
        adviceInputArea = document.createElement('div');
        adviceInputArea.id = 'advice-input-area';
        // Reuse chat input styling maybe?
        adviceInputArea.style.cssText = `display: flex; align-items: center; width: 100%; padding: 8px 10px; box-sizing: border-box; margin-bottom: 10px;`;

        adviceTextInput = document.createElement('input');
        adviceTextInput.type = 'text';
        adviceTextInput.id = 'advice-text-input';
        adviceTextInput.placeholder = 'Talk to me... ♡';
        adviceTextInput.style.cssText = `flex-grow: 1; padding: 10px 15px; border: 1px solid var(--chat-input-border); background-color: var(--chat-input-bg); color: var(--chat-input-text); border-radius: 20px 0 0 20px; font-family: inherit; font-size: 1em; outline: none; transition: all 0.2s ease;`;
        adviceTextInput.onkeypress = (e) => { if (e.key === 'Enter' && sessionActive && !isGenerating) { e.preventDefault(); _handleUserInput(); } };

        adviceSendButton = document.createElement('button');
        adviceSendButton.id = 'advice-send-button';
        adviceSendButton.textContent = 'Send';
        adviceSendButton.style.cssText = `padding: 10px 20px; border: 1px solid var(--chat-input-border); border-left: none; background: linear-gradient(45deg, var(--send-button-bg-1), var(--send-button-bg-2)); color: white; font-weight: bold; cursor: pointer; border-radius: 0 20px 20px 0; transition: background 0.2s; font-size: 1em;`;
        adviceSendButton.onclick = _handleUserInput;

        adviceInputArea.appendChild(adviceTextInput);
        adviceInputArea.appendChild(adviceSendButton);
        bottomSection.appendChild(adviceInputArea);

        // Controls Area
        controlsArea = document.createElement('div');
        controlsArea.id = 'advice-controls-area';
        controlsArea.style.cssText = `display: flex; justify-content: center; align-items: center; gap: 10px; margin-bottom: 5px; flex-wrap: wrap;`;

        viewCurrentSessionButton = document.createElement('button');
        viewCurrentSessionButton.id = 'advice-view-current-button';
        viewCurrentSessionButton.textContent = 'Current Chat 📜';
        viewCurrentSessionButton.className = 'rps-choice-button secondary';
        viewCurrentSessionButton.title = 'View the log for this advice session';
        viewCurrentSessionButton.onclick = _showCurrentSessionView;
        controlsArea.appendChild(viewCurrentSessionButton);

        viewLibraryButton = document.createElement('button');
        viewLibraryButton.id = 'advice-view-library-button';
        viewLibraryButton.textContent = 'Advice Log 📚';
        viewLibraryButton.className = 'rps-choice-button secondary';
        viewLibraryButton.title = 'View saved past advice sessions';
        viewLibraryButton.onclick = _createLibraryListView; // Function to show library
        controlsArea.appendChild(viewLibraryButton);

        newSessionButton = document.createElement('button');
        newSessionButton.id = 'advice-new-session-button';
        newSessionButton.textContent = 'New Session? ♡';
        newSessionButton.className = 'rps-choice-button';
        newSessionButton.style.display = 'none'; // Initially hidden
        newSessionButton.onclick = _handleNewSession;
        controlsArea.appendChild(newSessionButton);

        backToChatButton = document.createElement('button');
        backToChatButton.id = 'back-to-chat-button'; // Reuse ID for styling consistency
        backToChatButton.textContent = 'Back to Main Chat';
        backToChatButton.className = 'rps-choice-button secondary';
        backToChatButton.onclick = () => { if (typeof switchToChatView === 'function') switchToChatView(); };
        controlsArea.appendChild(backToChatButton);

        bottomSection.appendChild(controlsArea);
        adviceCornerView.appendChild(bottomSection);

        gameUiContainer.appendChild(adviceCornerView);

        // Set initial state
        _updateCharacterVisuals(); // Set colors
        _handleNewSession(); // Start the first session automatically
    }

    function _createBoothGraphic() {
        const booth = document.createElement('div');
        booth.style.cssText = `
            width: 220px; height: 200px;
            position: relative; /* Changed from absolute for simpler centering */
            margin: 0 auto; /* Center the booth */
            display: flex; flex-direction: column; align-items: center;
            /* Perspective for potential 3D effects later */
            /* perspective: 500px; */
        `;

        // Top Sign
        const signTop = document.createElement('div');
        signTop.id = 'advice-booth-sign-top';
        const signTopText = (currentPersonaInGame === 'Kana') ? "Kana's Complaints 😒" : "Mika's Advice Corner ♡";
        signTop.textContent = signTopText;
        signTop.style.cssText = `
            width: 100%; background-color: #b4846c; /* Wood color */
            color: #4d3a30; /* Dark text */ font-weight: bold; text-align: center;
            padding: 8px 5px; border: 3px solid #8d6e63; /* Darker wood border */
            border-bottom: none; border-radius: 5px 5px 0 0; box-sizing: border-box;
            font-size: 0.9em; z-index: 2; letter-spacing: 1px;
        `;
        booth.appendChild(signTop);

        // Counter
        const counter = document.createElement('div');
        counter.id = 'advice-booth-counter';
        counter.style.cssText = `
            width: 100%; height: 70px; background-color: #b4846c; /* Wood color */
            border: 3px solid #8d6e63; border-radius: 0 0 8px 8px;
            position: relative; /* For the IN/OUT sign */
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 4px 6px rgba(0,0,0,0.2); z-index: 2;
        `;

        // IN/OUT Sign on Counter
        const inOutSign = document.createElement('div');
        inOutSign.style.cssText = `
            background-color: #f5f5f5; color: #333;
            padding: 4px 10px; border: 2px solid #555; border-radius: 4px;
            font-size: 0.9em; font-weight: bold;
            box-shadow: 1px 1px 3px rgba(0,0,0,0.3);
            text-align: center;
        `;
        boothSignInOut = document.createElement('span'); // Assign to state variable
        inOutSign.appendChild(boothSignInOut);
        counter.appendChild(inOutSign);
        booth.appendChild(counter);

        // Side Supports (Optional visual flair)
        const supportLeft = document.createElement('div');
        supportLeft.style.cssText = `position: absolute; left: -8px; top: 0; bottom: 0; width: 10px; background-color: #8d6e63; border-radius: 3px 0 0 3px; z-index: 1;`;
        // booth.appendChild(supportLeft); // Add if desired
        const supportRight = document.createElement('div');
        supportRight.style.cssText = `position: absolute; right: -8px; top: 0; bottom: 0; width: 10px; background-color: #8d6e63; border-radius: 0 3px 3px 0; z-index: 1;`;
        // booth.appendChild(supportRight); // Add if desired

        return booth;
    }

    function _createCharacterGraphic() {
        const container = document.createElement('div');
        container.id = 'advice-character-graphic';
        // Reuse Gotchi graphic styling/size
        container.style.cssText = `width: 80px; height: 100px; position: relative; margin: 0 auto; /* Center it */`;

        const colors = (currentPersonaInGame === 'Kana') ? KANA_COLORS : MIKA_COLORS;
        const bodySize = 60, earSize = 20, eyeSize = 8, tailWidth = 8, tailHeight = 35;

        charBody = document.createElement('div'); charBody.id = 'advice-char-body';
        charBody.style.cssText = `position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: ${bodySize}px; height: ${bodySize}px; background-color: ${colors.body}; border-radius: 10px; border: 1px solid ${colors.accent};`; container.appendChild(charBody);
        charEarLeft = document.createElement('div'); charEarLeft.id = 'advice-char-ear-left';
        charEarLeft.style.cssText = `position: absolute; top: -${earSize * 0.8}px; left: ${bodySize * 0.1}px; width: 0; height: 0; border-left: ${earSize / 2}px solid transparent; border-right: ${earSize / 2}px solid transparent; border-bottom: ${earSize}px solid ${colors.accent};`; charBody.appendChild(charEarLeft);
        charEarRight = document.createElement('div'); charEarRight.id = 'advice-char-ear-right';
        charEarRight.style.cssText = `position: absolute; top: -${earSize * 0.8}px; right: ${bodySize * 0.1}px; width: 0; height: 0; border-left: ${earSize / 2}px solid transparent; border-right: ${earSize / 2}px solid transparent; border-bottom: ${earSize}px solid ${colors.accent};`; charBody.appendChild(charEarRight);
        charEyeLeft = document.createElement('div'); charEyeLeft.id = 'advice-char-eye-left';
        charEyeLeft.style.cssText = `position: absolute; top: ${bodySize * 0.3}px; left: ${bodySize * 0.25}px; width: ${eyeSize}px; height: ${eyeSize}px; background-color: ${colors.eyes}; border-radius: 50%;`; charBody.appendChild(charEyeLeft);
        charEyeRight = document.createElement('div'); charEyeRight.id = 'advice-char-eye-right';
        charEyeRight.style.cssText = `position: absolute; top: ${bodySize * 0.3}px; right: ${bodySize * 0.25}px; width: ${eyeSize}px; height: ${eyeSize}px; background-color: ${colors.eyes}; border-radius: 50%;`; charBody.appendChild(charEyeRight);
        charTail = document.createElement('div'); charTail.id = 'advice-char-tail';
        charTail.style.cssText = `position: absolute; bottom: ${bodySize * 0.1}px; left: -${tailWidth * 1.5}px; width: ${tailWidth}px; height: ${tailHeight}px; border-radius: 4px 4px 10px 10px / 50px 50px 10px 10px; background-color: ${colors.accent}; transform-origin: bottom right; animation: tail-sway 2s ease-in-out infinite alternate;`;
        const tailSwayKeyframes = [{ transform: 'rotate(-10deg)' }, { transform: 'rotate(10deg)' }];
        try { charTail.animate(tailSwayKeyframes, { duration: 1500 + Math.random() * 500, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }); } catch(e) {console.warn("Tail animation failed", e);}
        charBody.appendChild(charTail);

        // Add bounce animation
        bounceAnimation = container.animate([{ transform: 'translateY(0px)' }, { transform: 'translateY(-4px)' }, { transform: 'translateY(0px)' }], { duration: 900 + Math.random() * 200, iterations: Infinity, easing: 'ease-in-out' });

        return container;
    }

    function _updateCharacterVisuals() {
        // Update colors if needed (e.g., on persona switch, though usually handled by full UI recreate)
        const colors = (currentPersonaInGame === 'Kana') ? KANA_COLORS : MIKA_COLORS;
        if (charBody) charBody.style.backgroundColor = colors.body;
        if (charBody) charBody.style.borderColor = colors.accent;
        if (charEarLeft) charEarLeft.style.borderBottomColor = colors.accent;
        if (charEarRight) charEarRight.style.borderBottomColor = colors.accent;
        if (charEyeLeft) charEyeLeft.style.backgroundColor = colors.eyes;
        if (charEyeRight) charEyeRight.style.backgroundColor = colors.eyes;
        if (charTail) charTail.style.backgroundColor = colors.accent;

        // Update message bubble color
        if (adviceMessageBubble) {
           adviceMessageBubble.style.color = (currentPersonaInGame === 'Kana') ? 'var(--kana-popup-border, #b39ddb)' : 'var(--mika-message-name, #f06292)';
        }
    }

    function _updateSignInOutSign() {
        if (!boothSignInOut) return;
        const signText = sessionActive ? `${currentPersonaInGame.toUpperCase()} IS IN` : `${currentPersonaInGame.toUpperCase()} IS OUT`;
        boothSignInOut.textContent = signText;
    }

    // --- Animations (Placeholders) ---
    function _playWalkOffAnimation(callback) {
        console.log("Playing Walk Off Animation (Placeholder)...");
        if (characterGraphicContainer) {
            // Simple Hide:
            characterGraphicContainer.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
            characterGraphicContainer.style.opacity = '0';
            characterGraphicContainer.style.transform = 'translateX(100px)'; // Move off screen
        }
        _updateSignInOutSign(); // Update sign immediately
        setTimeout(() => {
            if (characterGraphicContainer) characterGraphicContainer.style.display = 'none'; // Hide fully after transition
            if (callback) callback();
        }, 500); // Duration of transition
    }

    function _playWalkOnAnimation(callback) {
        console.log("Playing Walk On Animation (Placeholder)...");
        if (characterGraphicContainer) {
            // Simple Show:
            characterGraphicContainer.style.display = 'block';
            // Reset styles before starting transition
            characterGraphicContainer.style.opacity = '0';
            characterGraphicContainer.style.transform = 'translateX(-100px)'; // Start off screen left
            // Force reflow before applying transition styles
            void characterGraphicContainer.offsetWidth;
            characterGraphicContainer.style.transition = 'opacity 0.5s ease-in, transform 0.5s ease-in';
            characterGraphicContainer.style.opacity = '1';
            characterGraphicContainer.style.transform = 'translateX(0)';
        }
        _updateSignInOutSign(); // Update sign immediately
        setTimeout(() => {
            if (callback) callback();
        }, 500); // Duration of transition
    }

    // --- Session & Chat Logic ---
    function _setLoadingState(isLoading) {
        isGenerating = isLoading;
        if (statusArea) {
            statusArea.textContent = isLoading ? `${currentPersonaInGame} is thinking...` : '';
            statusArea.style.display = isLoading ? 'block' : 'none';
        }
        if (adviceTextInput) adviceTextInput.disabled = isLoading || !sessionActive;
        if (adviceSendButton) adviceSendButton.disabled = isLoading || !sessionActive;
        if (viewCurrentSessionButton) viewCurrentSessionButton.disabled = isLoading;
        if (viewLibraryButton) viewLibraryButton.disabled = isLoading;
        if (newSessionButton) newSessionButton.disabled = isLoading;
        if (backToChatButton) backToChatButton.disabled = isLoading;
         // Also potentially disable character animation during loading?
         if(bounceAnimation) isLoading ? bounceAnimation.pause() : bounceAnimation.play();
    }

    async function _handleUserInput() {
        if (!sessionActive || isGenerating || !adviceTextInput || !adviceTextInput.value.trim()) {
            return;
        }
        const userText = adviceTextInput.value.trim();
        adviceTextInput.value = '';
        _setLoadingState(true);

        // Add user message to current session history
        adviceHistory.push({ sender: 'User', text: userText });
        if (adviceHistory.length > MAX_SESSION_HISTORY) {
            adviceHistory.shift(); // Keep history manageable
        }

        // Handle 'end' command
        if (userText.toLowerCase() === 'end') {
            console.log("User initiated end session.");
            await _handleEndSession(true); // Pass true to indicate user ended it
            _setLoadingState(false); // Ensure loading state is off after ending
            return;
        }

        try {
            const responseText = await _callAdviceAPI(userText);
            if (responseText) {
                adviceHistory.push({ sender: currentPersonaInGame, text: responseText });
                _displayAdviceBubble(responseText);
            } else {
                 _displayAdviceBubble(currentPersonaInGame === 'Kana' ? '...' : '*confused mrow?*');
            }
        } catch (error) {
            console.error("Error getting advice response:", error);
            _displayAdviceBubble(currentPersonaInGame === 'Kana' ? 'Error.' : 'Mrow?');
        } finally {
            _setLoadingState(false);
            if (adviceTextInput && sessionActive) adviceTextInput.focus(); // Refocus if session still active
        }
    }

    async function _callAdviceAPI(userInput) {
        if (!apiCaller || !currentApiKey) return Promise.reject("API Caller or Key missing");

        const contextTurns = adviceHistory.slice(-5); // Send last 5 turns for context
        const apiContext = contextTurns.map(turn => ({
             role: (turn.sender === 'User') ? 'user' : 'model',
             parts: [{ text: turn.text }]
        }));

        const personaPromptPart = (currentPersonaInGame === 'Kana')
            ? `You are Kana, sitting in your 'Complaints Booth'. ${currentUserName} is talking to you.`
            : `You are Mika, sitting in your 'Advice Corner'. Your best friend ${currentUserName} is talking to you.`;

        const prompt = `[ROLE: ${personaPromptPart} Maintain your core personality (sarcastic/grumpy for Kana, bubbly/playful for Mika). Respond directly to their last message: "${userInput}". Keep your response very short, suitable for a brief speech bubble (max 1-2 sentences). Do NOT offer life advice unless specifically asked. Focus on conversational interaction. Output only the response text.]`;

        try {
            // Use callMikaApiForApp which includes API count increment
            const response = await callMikaApiForApp(prompt, apiContext);
            return response;
        } catch (error) {
            console.error("Advice API call failed:", error);
            return null; // Or return a specific error message
        }
    }

    function _displayAdviceBubble(text) {
        if (!adviceMessageBubble) return;
        const cleanText = _sanitizeHTML(text);
        adviceMessageBubble.innerHTML = cleanText; // Use innerHTML for potential basic formatting like <strong>

        // Update bubble color based on persona
        adviceMessageBubble.style.color = (currentPersonaInGame === 'Kana') ? 'var(--kana-popup-border, #b39ddb)' : 'var(--mika-message-name, #f06292)';

        // Animation: Make it appear and rise slightly
        requestAnimationFrame(() => {
            adviceMessageBubble.style.bottom = '145px'; // Move up slightly
            adviceMessageBubble.style.opacity = '1';
        });

        // Clear existing timers
        if (adviceMessageBubble.fadeTimeout) clearTimeout(adviceMessageBubble.fadeTimeout);

        // Set new timer to fade out
        adviceMessageBubble.fadeTimeout = setTimeout(() => {
            if (adviceMessageBubble) {
                adviceMessageBubble.style.opacity = '0';
                adviceMessageBubble.style.bottom = '130px'; // Move back down
            }
        }, MESSAGE_BUBBLE_DURATION_MS);
    }

    async function _handleEndSession(userInitiated = false) {
        if (!sessionActive) return; // Don't end if already ended

        sessionActive = false;
        _setLoadingState(true); // Show loading briefly while saving/animating

        // Disable input during animation/saving
        if (adviceTextInput) adviceTextInput.disabled = true;
        if (adviceSendButton) adviceSendButton.disabled = true;
        if (viewCurrentSessionButton) viewCurrentSessionButton.disabled = true; // Disable viewing current chat

        // 1. Play Walk Off Animation
        await new Promise(resolve => _playWalkOffAnimation(resolve));

        // 2. Save Session to Library (only if there was interaction)
        if (adviceHistory.length > 1) { // More than just the initial "[Session Start]" placeholder
            await _saveSessionToLibrary();
        } else {
            console.log("Session ended with no meaningful interaction, not saving to library.");
        }

        // 3. Update UI
        if (newSessionButton) newSessionButton.style.display = 'inline-block';
        if (adviceInputArea) adviceInputArea.style.display = 'none'; // Hide input area

        _setLoadingState(false);
        console.log("Advice session ended.");
        if (userInitiated && messageCallback) {
            messageCallback('System', `${currentPersonaInGame} ended the advice session.`);
        }
    }

    function _handleNewSession() {
        if (sessionActive || isGenerating) return; // Don't start if already active or loading

        _setLoadingState(true); // Show loading briefly

        // 1. Clear previous session data
        adviceHistory = [{ sender: 'System', text: '[Session Start]' }]; // Placeholder start

        // 2. Update UI
        if (newSessionButton) newSessionButton.style.display = 'none';
        if (adviceInputArea) adviceInputArea.style.display = 'flex'; // Show input area
        if (adviceTextInput) adviceTextInput.disabled = false;
        if (adviceSendButton) adviceSendButton.disabled = false;
        if (viewCurrentSessionButton) viewCurrentSessionButton.disabled = false; // Enable viewing current

        // 3. Play Walk On Animation
        _playWalkOnAnimation(() => {
            // 4. Set session active *after* animation
            sessionActive = true;
            _setLoadingState(false); // Hide loading
            if (adviceTextInput) adviceTextInput.focus();
            if (messageCallback) {
                messageCallback('System', `${currentPersonaInGame} is ready for advice!`);
            }
            console.log("New advice session started.");
        });
    }

    async function _generateSessionTitle() {
        if (!apiCaller || adviceHistory.length <= 1) return null; // Need more than just start message

        const firstUserMessage = adviceHistory.find(t => t.sender === 'User')?.text.substring(0, 100) || "a chat";
        const lastAssistantMessage = [...adviceHistory].reverse().find(t => t.sender !== 'User')?.text.substring(0, 100) || "some advice";
        const contextSummary = `The user started by saying something like "${firstUserMessage}..." and the session ended after the assistant said "${lastAssistantMessage}...".`;

        const prompt = `[ROLE: You are a creative title generator.] Generate a short, catchy title (4-8 words max) for an advice chat session. The GM was ${currentPersonaInGame}. ${contextSummary} Make the title reflect the persona (${currentPersonaInGame === 'Kana' ? 'sarcastic/dry' : 'cute/playful'}). Output only the title text, no extra characters or quotes.`;

        try {
            const titleResponse = await callMikaApiForApp(prompt); // Uses shared API caller
            if (titleResponse) {
                let cleanTitle = titleResponse.replace(/["'*]/g, '').trim();
                cleanTitle = cleanTitle.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                if (cleanTitle.length > 0 && cleanTitle.length < 80) {
                    console.log("Generated advice session title:", cleanTitle);
                    return cleanTitle;
                }
            }
            console.warn("Generated advice title was invalid or empty:", titleResponse);
        } catch (error) {
            console.error("API call for advice title failed:", error);
        }
        return `Advice: ${firstUserMessage.substring(0, 20)}...`; // Fallback title
    }

    async function _saveSessionToLibrary() {
        if (adviceHistory.length <= 1) return; // Don't save empty sessions
        const title = await _generateSessionTitle() || `Advice Session (${_formatDateForDisplay(_getCurrentTimestamp())})`;
        const sessionLog = {
            title: title,
            timestamp: _getCurrentTimestamp(),
            history: [...adviceHistory], // Copy history
            persona: currentPersonaInGame
        };
        adviceLibrary.push(sessionLog);
        _saveLibrary(); // Saves and handles pruning
        if (messageCallback) messageCallback('System', `Advice session "${title}" saved to log!`);
    }

    // --- History/Library Viewing ---
    function _showCurrentSessionView() {
         // Simple Alert version for now
         if(adviceHistory.length <= 1) {
             alert("No conversation yet in this session!");
             return;
         }
         let logText = `--- Current Advice Session (${currentPersonaInGame}) ---\n\n`;
         adviceHistory.forEach(turn => {
             if (turn.sender !== 'System') { // Skip the placeholder start message
                logText += `${turn.sender}: ${turn.text}\n`;
             }
         });
         alert(logText); // Replace with a proper modal/view later if desired
         console.log("Displayed current session history via alert.");
    }

    function _createLibraryListView() {
        _clearUI(); // Clear the main corner UI
        currentView = 'library_list';

        const libraryView = document.createElement('div');
        libraryView.className = 'library-view'; // Reuse StoryTime styling class
        libraryView.style.cssText = `width: 100%; height: 100%; display: flex; flex-direction: column;`; // Ensure it fills space

        const title = document.createElement('h2');
        title.textContent = 'Advice Session Log 📚';
        title.className = 'library-title';
        libraryView.appendChild(title);

        const backButton = document.createElement('button');
        backButton.textContent = '← Back to Advice Corner';
        backButton.className = 'rps-choice-button secondary library-back-button';
        backButton.onclick = _createMainUI; // Go back to the corner
        libraryView.appendChild(backButton);

        const listContainer = document.createElement('div');
        listContainer.id = 'advice-library-list-container';
        listContainer.style.cssText = `flex-grow: 1; overflow-y: auto; margin-top: 10px;`; // Fill remaining space
        libraryView.appendChild(listContainer);

        gameUiContainer.appendChild(libraryView);
        _renderHistoryList(listContainer); // Populate the list
    }

    function _renderHistoryList(container) {
        container.innerHTML = '';
        if (adviceLibrary.length === 0) {
            container.innerHTML = `<p style="text-align: center; font-style: italic; color: var(--system-message-text);">No saved advice sessions yet!</p>`;
            return;
        }
        adviceLibrary.forEach((session, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'library-item'; // Reuse StoryTime styling class
            itemDiv.onclick = () => _createHistoryDetailView(index);

            const titleSpan = document.createElement('span');
            titleSpan.className = 'library-item-title';
            titleSpan.textContent = session.title || `Advice Session ${adviceLibrary.length - index}`;
            itemDiv.appendChild(titleSpan);

            const dateSpan = document.createElement('span');
            dateSpan.className = 'library-item-date';
            dateSpan.textContent = `Persona: ${session.persona} | Saved: ${_formatDateForDisplay(session.timestamp)}`;
            itemDiv.appendChild(dateSpan);

            container.appendChild(itemDiv);
        });
    }

    function _createHistoryDetailView(sessionIndex) {
         _clearUI();
         currentView = 'library_detail';
         const session = adviceLibrary[sessionIndex];
         if (!session) { _createLibraryListView(); return; } // Go back if session not found

         const detailView = document.createElement('div');
         detailView.className = 'story-detail-view'; // Reuse StoryTime styling
         detailView.style.cssText = `width: 100%; height: 100%; display: flex; flex-direction: column;`;

         const title = document.createElement('h3');
         title.textContent = session.title || `Advice Session ${adviceLibrary.length - sessionIndex}`;
         title.style.textAlign = 'center'; title.style.color = 'var(--chat-header-text)'; title.style.marginBottom = '10px';
         detailView.appendChild(title);

         const backButton = document.createElement('button');
         backButton.textContent = '← Back to Advice Log';
         backButton.className = 'rps-choice-button secondary library-back-button'; // Reuse styles
         backButton.onclick = _createLibraryListView;
         detailView.appendChild(backButton);

         const contentArea = document.createElement('div');
         contentArea.style.cssText = `flex-grow: 1; overflow-y: auto; margin-top: 10px; border: 1px solid var(--chat-input-border); border-radius: 5px; padding: 10px; background-color: rgba(0,0,0,0.1);`;

         session.history.forEach(turn => {
             if (turn.sender === 'System') return; // Skip placeholder

             const turnP = document.createElement('p');
             const cleanText = _sanitizeHTML(turn.text).replace(/(?<!<br>)\n/g, '<br>'); // Basic formatting

             if (turn.sender === 'User') {
                 turnP.style.cssText = `text-align: right; color: var(--user-message-text); margin-left: 20%;`;
                 turnP.innerHTML = `<strong>${currentUserName}:</strong> ${cleanText}`;
             } else { // Mika or Kana
                 turnP.style.cssText = `text-align: left; color: var(--mika-message-text); margin-right: 20%;`;
                 turnP.innerHTML = `<strong>${turn.sender}:</strong> ${cleanText}`;
             }
             contentArea.appendChild(turnP);
         });
         detailView.appendChild(contentArea);
         gameUiContainer.appendChild(detailView);
         if(contentArea) contentArea.scrollTop = 0; // Scroll to top of detail view
    }


    // --- Initialization and Exit ---
    function init(_gameUiContainer, _messageCallback, _apiCaller, userName, persona) {
        console.log("Initializing Advice Corner...");
        gameUiContainer = _gameUiContainer;
        messageCallback = _messageCallback;
        apiCaller = _apiCaller;
        currentUserName = userName || "User";
        currentPersonaInGame = persona || 'Mika';
        isGenerating = false;
        sessionActive = false; // Start inactive
        adviceHistory = [];

        if (!gameUiContainer) { console.error("Advice Corner UI container missing!"); return; }

        _loadLibrary();
        _createMainUI(); // Creates the main view, character starts "out" initially via _handleNewSession

        console.log(`Advice Corner initialized for ${currentUserName} with ${currentPersonaInGame}.`);
    }

    async function onExit() {
        console.log("AdviceCorner onExit called.");
        // If a session was active and had content, save it before exiting
        if (sessionActive && adviceHistory.length > 1) {
             console.log("Saving active advice session on exit...");
             sessionActive = false; // Mark as inactive before saving
             _updateSignInOutSign();
             if(characterGraphicContainer) characterGraphicContainer.style.display = 'none'; // Hide instantly on exit
             await _saveSessionToLibrary();
        }
        // Clear state
        adviceHistory = [];
        sessionActive = false;
        isGenerating = false;
        currentView = 'corner';
        _clearUI(); // Clean up DOM elements
        console.log("Advice Corner exited and cleaned up.");
        return Promise.resolve(true);
    }

    // --- Public Interface ---
    return {
        init: init,
        onExit: onExit
    };

})();

// --- END OF FILE advice_corner.js ---