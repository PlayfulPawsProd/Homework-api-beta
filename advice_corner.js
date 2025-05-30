// --- START OF FILE advice_corner.js ---

// Nyaa~! Mika & Kana's Advice Corner! Tell me everything! ♡ (Or... complain, whatever. - Kana)

const AdviceCorner = (() => {
    // --- Settings & Constants ---
    const LIBRARY_STORAGE_KEY = 'mikaAdviceLog_v1';
    const MAX_LIBRARY_ENTRIES = 30;
    const MAX_SESSION_HISTORY = 50;
    const MESSAGE_TEXT_DURATION_MS = 4000;
    const MESSAGE_FADE_DURATION_MS = 1000;
    const FAREWELL_LINGER_MS = 6000; // ** UPDATED: Linger delay to 6 seconds **
    const FAREWELL_POST_MESSAGE_DELAY_MS = 100;
    const MIKA_COLORS = { body: '#ffc1e3', accent: '#f48fb1', eyes: '#222' };
    const KANA_COLORS = { body: '#5c546d', accent: '#423d51', eyes: '#111' };

    // --- State ---
    let gameUiContainer = null;
    let messageCallback = null; // For main chat messages (system/errors/farewell)
    let apiCaller = null;
    let currentUserName = "User";
    let currentPersonaInGame = 'Mika';

    let adviceHistory = [];
    let adviceLibrary = [];
    let isGenerating = false;
    let sessionActive = false;
    let currentView = 'corner';

    // --- DOM Element References ---
    let adviceCornerView = null;
    let characterGraphicContainer = null;
    let boothContainer = null;
    let boothSignInOut = null;
    let adviceDisplayArea = null; // For floating text (used during session)
    let adviceInputArea = null;
    let adviceTextInput = null;
    let adviceSendButton = null;
    let controlsArea = null;
    let viewCurrentSessionButton = null;
    let viewLibraryButton = null;
    let newSessionButton = null;
    let backToChatButton = null;
    let statusArea = null;
    let currentSessionModalOverlay = null;

    // Character parts
    let charBody = null, charEarLeft = null, charEarRight = null, charEyeLeft = null, charEyeRight = null, charTail = null;
    let bounceAnimation = null;

    // --- Helper Functions ---
    function _getCurrentTimestamp() { return Date.now(); }
    function _formatDateForDisplay(timestamp) { if (!timestamp) return 'N/A'; try { return new Date(timestamp).toLocaleString(); } catch (e) { return 'Invalid Date'; } }
    function _sanitizeHTML(str) { if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) { return DOMPurify.sanitize(str, { USE_PROFILES: { html: true }, ALLOWED_TAGS: ['strong', 'em', 'b', 'i', 'br'] }); } console.warn("DOMPurify missing in AdviceCorner, basic fallback."); return str.replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    // --- Library Persistence ---
    function _loadLibrary() { /* ... Same ... */
        try { const stored = localStorage.getItem(LIBRARY_STORAGE_KEY); if (stored) { adviceLibrary = JSON.parse(stored); adviceLibrary = adviceLibrary.map(log => ({ ...log, persona: log.persona || 'Mika' })); adviceLibrary.sort((a, b) => b.timestamp - a.timestamp); console.log(`Loaded ${adviceLibrary.length} advice sessions.`); } else { adviceLibrary = []; }
        } catch (e) { console.error("Failed to load advice library:", e); adviceLibrary = []; localStorage.removeItem(LIBRARY_STORAGE_KEY); }
    }
    function _saveLibrary() { /* ... Same ... */
        try { if (adviceLibrary.length > MAX_LIBRARY_ENTRIES) { adviceLibrary.sort((a, b) => b.timestamp - a.timestamp); adviceLibrary = adviceLibrary.slice(0, MAX_LIBRARY_ENTRIES); console.log(`Pruned advice library to ${MAX_LIBRARY_ENTRIES} entries.`); } localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(adviceLibrary)); console.log(`Saved ${adviceLibrary.length} advice sessions.`);
        } catch (e) { console.error("Failed to save advice library:", e); }
    }

    // --- UI Creation ---
    function _clearUI() { /* ... Same ... */
        if (gameUiContainer) gameUiContainer.innerHTML = ''; adviceCornerView = characterGraphicContainer = boothContainer = boothSignInOut = adviceDisplayArea = adviceInputArea = adviceTextInput = adviceSendButton = controlsArea = viewCurrentSessionButton = viewLibraryButton = newSessionButton = backToChatButton = statusArea = null; charBody = charEarLeft = charEarRight = charEyeLeft = charEyeRight = charTail = null; if (bounceAnimation) bounceAnimation.cancel(); bounceAnimation = null; if (currentSessionModalOverlay && currentSessionModalOverlay.parentNode) { currentSessionModalOverlay.parentNode.removeChild(currentSessionModalOverlay); } currentSessionModalOverlay = null; currentView = 'corner';
    }
    function _createMainUI() { /* ... Same ... */
        _clearUI(); currentView = 'corner'; adviceCornerView = document.createElement('div'); adviceCornerView.id = 'advice-corner-view'; adviceCornerView.style.cssText = `width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 10px; box-sizing: border-box; position: relative; overflow: hidden;`; statusArea = document.createElement('div'); statusArea.id = 'advice-status-area'; statusArea.style.cssText = `position: absolute; top: 5px; left: 50%; transform: translateX(-50%); font-style: italic; color: var(--typing-indicator-text); z-index: 5; background: rgba(0,0,0,0.5); padding: 2px 8px; border-radius: 5px; display: none; font-size: 0.9em;`; adviceCornerView.appendChild(statusArea); const topSection = document.createElement('div'); topSection.style.cssText = `position: relative; width: 100%; display: flex; justify-content: center; align-items: flex-end; flex-grow: 1; min-height: 250px;`; adviceDisplayArea = document.createElement('div'); adviceDisplayArea.id = 'advice-text-display'; adviceDisplayArea.style.cssText = ` position: absolute; top: 10px; left: 50%; transform: translateX(-50%); width: 95%; color: var(--mika-message-name, #f06292); font-weight: bold; padding: 5px; font-size: 1em; text-align: center; opacity: 0; transition: opacity 0.3s ease-in; z-index: 3; white-space: normal; pointer-events: none; text-shadow: 1px 1px 2px rgba(0,0,0,0.5); min-height: 1.5em; line-height: 1.4; `; topSection.appendChild(adviceDisplayArea); boothContainer = _createBoothGraphic(); topSection.appendChild(boothContainer); characterGraphicContainer = _createCharacterGraphic(); characterGraphicContainer.style.position = 'absolute'; characterGraphicContainer.style.bottom = '140px'; characterGraphicContainer.style.zIndex = '3'; topSection.appendChild(characterGraphicContainer); adviceCornerView.appendChild(topSection); const bottomSection = document.createElement('div'); bottomSection.style.cssText = `width: 100%; max-width: 450px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center;`; controlsArea = document.createElement('div'); controlsArea.id = 'advice-controls-area'; controlsArea.style.cssText = `display: flex; justify-content: center; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap;`; viewCurrentSessionButton = document.createElement('button'); viewCurrentSessionButton.id = 'advice-view-current-button'; viewCurrentSessionButton.textContent = 'Current Chat 📜'; viewCurrentSessionButton.className = 'rps-choice-button secondary'; viewCurrentSessionButton.title = 'View the log for this advice session'; viewCurrentSessionButton.onclick = _showCurrentSessionView; viewCurrentSessionButton.disabled = true; controlsArea.appendChild(viewCurrentSessionButton); viewLibraryButton = document.createElement('button'); viewLibraryButton.id = 'advice-view-library-button'; viewLibraryButton.textContent = 'Advice Log 📚'; viewLibraryButton.className = 'rps-choice-button secondary'; viewLibraryButton.title = 'View saved past advice sessions'; viewLibraryButton.onclick = _createLibraryListView; controlsArea.appendChild(viewLibraryButton); newSessionButton = document.createElement('button'); newSessionButton.id = 'advice-new-session-button'; newSessionButton.textContent = 'New Session? ♡'; newSessionButton.className = 'rps-choice-button'; newSessionButton.style.display = 'none'; newSessionButton.onclick = _handleNewSession; controlsArea.appendChild(newSessionButton); backToChatButton = document.createElement('button'); backToChatButton.id = 'back-to-chat-button'; backToChatButton.textContent = 'Back to Main Chat'; backToChatButton.className = 'rps-choice-button secondary'; backToChatButton.onclick = () => { if (typeof switchToChatView === 'function') switchToChatView(); }; controlsArea.appendChild(backToChatButton); bottomSection.appendChild(controlsArea); adviceInputArea = document.createElement('div'); adviceInputArea.id = 'advice-input-area'; adviceInputArea.style.cssText = `display: flex; align-items: center; width: 100%; padding: 8px 10px; box-sizing: border-box; margin-bottom: 5px;`; adviceTextInput = document.createElement('input'); adviceTextInput.type = 'text'; adviceTextInput.id = 'advice-text-input'; adviceTextInput.placeholder = 'Talk to me... (type "end" to finish) ♡'; adviceTextInput.style.cssText = `flex-grow: 1; padding: 10px 15px; border: 1px solid var(--chat-input-border); background-color: var(--chat-input-bg); color: var(--chat-input-text); border-radius: 20px 0 0 20px; font-family: inherit; font-size: 1em; outline: none; transition: all 0.2s ease;`; adviceTextInput.onkeypress = (e) => { if (e.key === 'Enter' && sessionActive && !isGenerating) { e.preventDefault(); _handleUserInput(); } }; adviceSendButton = document.createElement('button'); adviceSendButton.id = 'advice-send-button'; adviceSendButton.textContent = 'Send'; adviceSendButton.style.cssText = `padding: 10px 20px; border: 1px solid var(--chat-input-border); border-left: none; background: linear-gradient(45deg, var(--send-button-bg-1), var(--send-button-bg-2)); color: white; font-weight: bold; cursor: pointer; border-radius: 0 20px 20px 0; transition: background 0.2s; font-size: 1em;`; adviceSendButton.onclick = _handleUserInput; adviceInputArea.appendChild(adviceTextInput); adviceInputArea.appendChild(adviceSendButton); bottomSection.appendChild(adviceInputArea); adviceCornerView.appendChild(bottomSection); gameUiContainer.appendChild(adviceCornerView); _updateCharacterVisuals(); _handleNewSession();
    }

    // --- Graphics/Signs (No changes) ---
    function _createBoothGraphic() { /* ... Same ... */ const booth = document.createElement('div'); booth.style.cssText = `width: 220px; height: 200px; position: relative; margin: 0 auto; display: flex; flex-direction: column; align-items: center;`; const signTop = document.createElement('div'); signTop.id = 'advice-booth-sign-top'; const signTopText = (currentPersonaInGame === 'Kana') ? "Kana's Complaints 😒" : "Mika's Advice Corner ♡"; signTop.textContent = signTopText; signTop.style.cssText = `width: 100%; background-color: #b4846c; color: #4d3a30; font-weight: bold; text-align: center; padding: 8px 5px; border: 3px solid #8d6e63; border-bottom: none; border-radius: 5px 5px 0 0; box-sizing: border-box; font-size: 0.9em; z-index: 2; letter-spacing: 1px;`; booth.appendChild(signTop); const counter = document.createElement('div'); counter.id = 'advice-booth-counter'; counter.style.cssText = `width: 100%; height: 70px; background-color: #b4846c; border: 3px solid #8d6e63; border-radius: 0 0 8px 8px; position: relative; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.2); z-index: 2;`; const inOutSign = document.createElement('div'); inOutSign.style.cssText = `background-color: #f5f5f5; color: #333; padding: 4px 10px; border: 2px solid #555; border-radius: 4px; font-size: 0.9em; font-weight: bold; box-shadow: 1px 1px 3px rgba(0,0,0,0.3); text-align: center;`; boothSignInOut = document.createElement('span'); inOutSign.appendChild(boothSignInOut); counter.appendChild(inOutSign); booth.appendChild(counter); return booth; }
    function _createCharacterGraphic() { /* ... Same ... */ const container = document.createElement('div'); container.id = 'advice-character-graphic'; container.style.cssText = `width: 80px; height: 100px; position: relative; margin: 0 auto;`; const colors = (currentPersonaInGame === 'Kana') ? KANA_COLORS : MIKA_COLORS; const bodySize = 60, earSize = 20, eyeSize = 8, tailWidth = 8, tailHeight = 35; charBody = document.createElement('div'); charBody.id = 'advice-char-body'; charBody.style.cssText = `position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: ${bodySize}px; height: ${bodySize}px; background-color: ${colors.body}; border-radius: 10px; border: 1px solid ${colors.accent};`; container.appendChild(charBody); charEarLeft = document.createElement('div'); charEarLeft.id = 'advice-char-ear-left'; charEarLeft.style.cssText = `position: absolute; top: -${earSize * 0.8}px; left: ${bodySize * 0.1}px; width: 0; height: 0; border-left: ${earSize / 2}px solid transparent; border-right: ${earSize / 2}px solid transparent; border-bottom: ${earSize}px solid ${colors.accent};`; charBody.appendChild(charEarLeft); charEarRight = document.createElement('div'); charEarRight.id = 'advice-char-ear-right'; charEarRight.style.cssText = `position: absolute; top: -${earSize * 0.8}px; right: ${bodySize * 0.1}px; width: 0; height: 0; border-left: ${earSize / 2}px solid transparent; border-right: ${earSize / 2}px solid transparent; border-bottom: ${earSize}px solid ${colors.accent};`; charBody.appendChild(charEarRight); charEyeLeft = document.createElement('div'); charEyeLeft.id = 'advice-char-eye-left'; charEyeLeft.style.cssText = `position: absolute; top: ${bodySize * 0.3}px; left: ${bodySize * 0.25}px; width: ${eyeSize}px; height: ${eyeSize}px; background-color: ${colors.eyes}; border-radius: 50%;`; charBody.appendChild(charEyeLeft); charEyeRight = document.createElement('div'); charEyeRight.id = 'advice-char-eye-right'; charEyeRight.style.cssText = `position: absolute; top: ${bodySize * 0.3}px; right: ${bodySize * 0.25}px; width: ${eyeSize}px; height: ${eyeSize}px; background-color: ${colors.eyes}; border-radius: 50%;`; charBody.appendChild(charEyeRight); charTail = document.createElement('div'); charTail.id = 'advice-char-tail'; charTail.style.cssText = `position: absolute; bottom: ${bodySize * 0.1}px; left: -${tailWidth * 1.5}px; width: ${tailWidth}px; height: ${tailHeight}px; border-radius: 4px 4px 10px 10px / 50px 50px 10px 10px; background-color: ${colors.accent}; transform-origin: bottom right; animation: tail-sway 2s ease-in-out infinite alternate;`; const tailSwayKeyframes = [{ transform: 'rotate(-10deg)' }, { transform: 'rotate(10deg)' }]; try { charTail.animate(tailSwayKeyframes, { duration: 1500 + Math.random() * 500, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }); } catch(e) {console.warn("Tail animation failed", e);} charBody.appendChild(charTail); bounceAnimation = container.animate([{ transform: 'translateY(0px)' }, { transform: 'translateY(-4px)' }, { transform: 'translateY(0px)' }], { duration: 900 + Math.random() * 200, iterations: Infinity, easing: 'ease-in-out' }); return container; }
    function _updateCharacterVisuals() { /* ... Same ... */ const colors = (currentPersonaInGame === 'Kana') ? KANA_COLORS : MIKA_COLORS; if (charBody) charBody.style.backgroundColor = colors.body; if (charBody) charBody.style.borderColor = colors.accent; if (charEarLeft) charEarLeft.style.borderBottomColor = colors.accent; if (charEarRight) charEarRight.style.borderBottomColor = colors.accent; if (charEyeLeft) charEyeLeft.style.backgroundColor = colors.eyes; if (charEyeRight) charEyeRight.style.backgroundColor = colors.eyes; if (charTail) charTail.style.backgroundColor = colors.accent; if (adviceDisplayArea) { adviceDisplayArea.style.color = (currentPersonaInGame === 'Kana') ? 'var(--kana-popup-border, #b39ddb)' : 'var(--mika-message-name, #f06292)';} if(adviceTextInput && !adviceTextInput.disabled) { adviceTextInput.placeholder = (currentPersonaInGame === 'Kana') ? 'State your issue. (type "end" to finish)' : 'Talk to me... (type "end" to finish) ♡';} if(newSessionButton) { newSessionButton.textContent = (currentPersonaInGame === 'Kana') ? 'New Complaint.' : 'New Session? ♡'; } const signTop = document.getElementById('advice-booth-sign-top'); if (signTop) signTop.textContent = (currentPersonaInGame === 'Kana') ? "Kana's Complaints 😒" : "Mika's Advice Corner ♡"; _updateSignInOutSign(); }
    function _updateSignInOutSign() { /* ... Same ... */ if (!boothSignInOut) return; const signText = sessionActive ? `${currentPersonaInGame.toUpperCase()} IS IN` : `${currentPersonaInGame.toUpperCase()} IS OUT`; boothSignInOut.textContent = signText; }
    function _playWalkOffAnimation(callback) { /* ... Same ... */ console.log("Playing Walk Off Animation..."); sessionActive = false; _updateSignInOutSign(); if (characterGraphicContainer) { characterGraphicContainer.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out'; characterGraphicContainer.style.opacity = '0'; characterGraphicContainer.style.transform = 'translateX(100px)'; } setTimeout(() => { if (characterGraphicContainer) characterGraphicContainer.style.display = 'none'; if (callback) callback(); }, 500); }
    function _playWalkOnAnimation(callback) { /* ... Same ... */ console.log("Playing Walk On Animation..."); if (characterGraphicContainer) { characterGraphicContainer.style.display = 'block'; characterGraphicContainer.style.opacity = '0'; characterGraphicContainer.style.transform = 'translateX(-100px)'; void characterGraphicContainer.offsetWidth; characterGraphicContainer.style.transition = 'opacity 0.5s ease-in, transform 0.5s ease-in'; characterGraphicContainer.style.opacity = '1'; characterGraphicContainer.style.transform = 'translateX(0)'; } setTimeout(() => { sessionActive = true; _updateSignInOutSign(); if (callback) callback(); }, 500); }

    // --- Session & Chat Logic ---
    function _setLoadingState(isLoading) { /* ... Same ... */ isGenerating = isLoading; if (statusArea) { statusArea.textContent = isLoading ? `${currentPersonaInGame} is thinking...` : ''; statusArea.style.display = isLoading ? 'block' : 'none'; } if (adviceTextInput) { adviceTextInput.disabled = isLoading || !sessionActive; if(!sessionActive) { adviceTextInput.placeholder = `${currentPersonaInGame} is away...`;} else if (isLoading) { adviceTextInput.placeholder = `${currentPersonaInGame} is thinking...`;} else { adviceTextInput.placeholder = (currentPersonaInGame === 'Kana') ? 'State your issue. (type "end" to finish)' : 'Talk to me... (type "end" to finish) ♡'; } } if (adviceSendButton) adviceSendButton.disabled = isLoading || !sessionActive; if (viewCurrentSessionButton) viewCurrentSessionButton.disabled = isLoading; if (viewLibraryButton) viewLibraryButton.disabled = isLoading; if (newSessionButton) newSessionButton.disabled = isLoading; if (backToChatButton) backToChatButton.disabled = isLoading; if (bounceAnimation) isLoading ? bounceAnimation.pause() : bounceAnimation.play(); }
    async function _handleUserInput() { /* ... Same ... */ if (!sessionActive || isGenerating || !adviceTextInput || !adviceTextInput.value.trim()) { return; } const userText = adviceTextInput.value.trim(); adviceTextInput.value = ''; _setLoadingState(true); adviceHistory.push({ sender: 'User', text: userText }); if (adviceHistory.length > 1 && viewCurrentSessionButton) { viewCurrentSessionButton.disabled = false; } if (adviceHistory.length > MAX_SESSION_HISTORY) { adviceHistory.shift(); } if (userText.toLowerCase() === 'end') { console.log("User initiated end session."); await _handleEndSession(true); _setLoadingState(false); return; } try { const responseText = await _callAdviceAPI(userText); if (responseText) { adviceHistory.push({ sender: currentPersonaInGame, text: responseText }); _displayAdviceMessage(responseText); } else { _displayAdviceMessage(currentPersonaInGame === 'Kana' ? '...' : '*confused mrow?*'); } } catch (error) { console.error("Error getting advice response:", error); _displayAdviceMessage(currentPersonaInGame === 'Kana' ? 'Error.' : 'Mrow?'); } finally { _setLoadingState(false); } }
    async function _callAdviceAPI(userInput) { /* ... Same ... */ if (!apiCaller) return Promise.reject("API Caller missing"); const contextTurns = adviceHistory.slice(-5); const apiContext = contextTurns.map(turn => ({ role: (turn.sender === 'User') ? 'user' : 'model', parts: [{ text: turn.text }] })); const personaPromptPart = (currentPersonaInGame === 'Kana') ? `You are Kana, sitting in your 'Complaints Booth'. ${currentUserName} is talking to you.` : `You are Mika, sitting in your 'Advice Corner'. Your best friend ${currentUserName} is talking to you.`; const prompt = `[ROLE: ${personaPromptPart} Maintain your core personality (sarcastic/grumpy for Kana, bubbly/playful for Mika). Respond directly to their last message: "${userInput}". Keep your response very short, suitable for displaying directly on screen for a few seconds (max 1-2 sentences). Do NOT offer life advice unless specifically asked. Focus on conversational interaction. Output only the response text.]`; try { const response = await callMikaApiForApp(prompt, apiContext); return response; } catch (error) { console.error("Advice API call failed:", error); return null; } }
    function _displayAdviceMessage(text) { /* ... Same ... */ if (!adviceDisplayArea) return; const cleanText = _sanitizeHTML(text); adviceDisplayArea.innerHTML = cleanText; adviceDisplayArea.style.color = (currentPersonaInGame === 'Kana') ? 'var(--kana-popup-border, #b39ddb)' : 'var(--mika-message-name, #f06292)'; requestAnimationFrame(() => { adviceDisplayArea.style.opacity = '1'; }); if (adviceDisplayArea.fadeTimeout) clearTimeout(adviceDisplayArea.fadeTimeout); if (adviceDisplayArea.clearTimeout) clearTimeout(adviceDisplayArea.clearTimeout); adviceDisplayArea.fadeTimeout = setTimeout(() => { if (adviceDisplayArea) { adviceDisplayArea.style.transition = `opacity ${MESSAGE_FADE_DURATION_MS / 1000}s ease-out`; adviceDisplayArea.style.opacity = '0'; adviceDisplayArea.clearTimeout = setTimeout(() => { if (adviceDisplayArea) { adviceDisplayArea.innerHTML = ''; adviceDisplayArea.style.transition = 'opacity 0.3s ease-in'; } }, MESSAGE_FADE_DURATION_MS); } }, MESSAGE_TEXT_DURATION_MS); }
    async function _generateSessionTitle() { /* ... Same ... */ if (!apiCaller || adviceHistory.length <= 1) return null; const firstUserMessage = adviceHistory.find(t => t.sender === 'User')?.text.substring(0, 100) || "a chat"; const lastAssistantMessage = [...adviceHistory].reverse().find(t => t.sender !== 'User')?.text.substring(0, 100) || "some advice"; const contextSummary = `The user started by saying something like "${firstUserMessage}..." and the session ended after the assistant said "${lastAssistantMessage}...".`; const prompt = `[ROLE: You are a creative title generator.] Generate a short, catchy title (4-8 words max) for an advice chat session. The GM was ${currentPersonaInGame}. ${contextSummary} Make the title reflect the persona (${currentPersonaInGame === 'Kana' ? 'sarcastic/dry' : 'cute/playful'}). Output only the title text, no extra characters or quotes.`; try { const titleResponse = await callMikaApiForApp(prompt); if (titleResponse) { let cleanTitle = titleResponse.replace(/["'*]/g, '').trim(); cleanTitle = cleanTitle.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '); if (cleanTitle.length > 0 && cleanTitle.length < 80) { console.log("Generated advice session title:", cleanTitle); return cleanTitle; } } console.warn("Generated advice title was invalid or empty:", titleResponse); } catch (error) { console.error("API call for advice title failed:", error); } return `Advice: ${firstUserMessage.substring(0, 20)}...`; }
    async function _saveSessionToLibrary() { /* ... Same ... */ if (adviceHistory.length <= 1) return; const title = await _generateSessionTitle() || `Advice Session (${_formatDateForDisplay(_getCurrentTimestamp())})`; const sessionLog = { title: title, timestamp: _getCurrentTimestamp(), history: [...adviceHistory], persona: currentPersonaInGame }; adviceLibrary.push(sessionLog); _saveLibrary(); if (messageCallback) messageCallback('System', `Advice session "${title}" saved to log!`); }

    // --- Farewell Message ---
    // ** UPDATED: Now returns message text, doesn't call messageCallback **
    async function _fetchFarewellMessageText() {
        if (!apiCaller) {
            console.warn("API Caller missing, cannot fetch farewell message text.");
            return (currentPersonaInGame === 'Kana') ? "Fine. Later." : "Bye bye for now, Master! ♡";
        }
        console.log(`Fetching farewell message text for ${currentPersonaInGame}...`);
        const personaPromptPart = (currentPersonaInGame === 'Kana') ? `You are Kana. ${currentUserName} just finished talking to you in your Complaints Booth.` : `You are Mika. Your best friend ${currentUserName} just finished talking to you in your Advice Corner.`;
        const prompt = `[ROLE: ${personaPromptPart} Give a very short (1 sentence), in-character farewell remark. For Kana: be dismissive, sarcastic, or grudging. For Mika: be sweet, playful, maybe a little sad they're leaving, or eager for next time. Output only the farewell text.]`;
        try {
            const farewellResponse = await callMikaApiForApp(prompt, []);
            if (farewellResponse) {
                return farewellResponse;
            } else {
                console.warn("API returned empty farewell response.");
                return (currentPersonaInGame === 'Kana') ? "Fine. Later." : "Bye bye for now, Master! ♡";
            }
        } catch (error) {
            console.error("Failed to fetch farewell message:", error);
            return (currentPersonaInGame === 'Kana') ? "*Static noise*" : "*Sad mrow...*";
        }
    }

    // ** UPDATED _handleEndSession **
    async function _handleEndSession(userInitiated = false) {
        if (!sessionActive) return;

        // Mark inactive and disable inputs immediately
        sessionActive = false;
        _updateSignInOutSign(); // Update sign first
        if (adviceTextInput) adviceTextInput.disabled = true;
        if (adviceSendButton) adviceSendButton.disabled = true;
        if (viewCurrentSessionButton) viewCurrentSessionButton.disabled = true;

        _setLoadingState(true); // Show "thinking" while saving/getting farewell

        // Save session (if needed)
        if (adviceHistory.length > 1) {
            await _saveSessionToLibrary();
        } else {
            console.log("Session ended with no meaningful interaction, not saving library.");
        }

        // Fetch farewell message TEXT
        const farewellText = await _fetchFarewellMessageText();

        _setLoadingState(false); // Turn off "thinking" message

        // Display farewell message IN THE APP's text display area
        _displayAdviceMessage(farewellText);

        console.log("Advice session ended. Character lingering...");

        // Set a timeout before starting the walk-off animation
        setTimeout(() => {
            // Double check view hasn't changed during the linger
            if (currentView !== 'corner') { console.log("View changed during linger, cancelling walk-off."); return; }
            console.log("Starting walk-off animation after delay.");
            _playWalkOffAnimation(() => {
                 // Double check view hasn't changed during animation
                 if (currentView !== 'corner') { console.log("View changed during walk-off, skipping button show."); return; }
                if (newSessionButton) newSessionButton.style.display = 'inline-block';
                console.log("Walk-off complete. New session button shown.");
            });
        }, FAREWELL_LINGER_MS); // Use the defined linger time
    }

    function _handleNewSession() { /* ... Same as previous ... */
        if (sessionActive || isGenerating) return; _setLoadingState(true); adviceHistory = [{ sender: 'System', text: '[Session Start]' }]; if (newSessionButton) newSessionButton.style.display = 'none'; if (adviceInputArea) adviceInputArea.style.display = 'flex'; if (viewCurrentSessionButton) viewCurrentSessionButton.disabled = true; _playWalkOnAnimation(() => { _setLoadingState(false); if (messageCallback) { messageCallback('System', `${currentPersonaInGame} is ready for advice!`); } console.log("New advice session started."); });
    }

    // --- History/Library Viewing ---
    function _showCurrentSessionView() { /* ... Same as previous ... */ _closeCurrentSessionModal(); currentSessionModalOverlay = document.createElement('div'); currentSessionModalOverlay.id = 'advice-session-modal-overlay'; currentSessionModalOverlay.className = 'popup-overlay'; currentSessionModalOverlay.style.display = 'flex'; currentSessionModalOverlay.onclick = (e) => { if (e.target === currentSessionModalOverlay) { _closeCurrentSessionModal(); } }; const modal = document.createElement('div'); modal.className = 'popup-modal'; modal.style.textAlign = 'left'; modal.style.maxHeight = '70vh'; modal.style.minWidth = '80%'; modal.onclick = (e) => e.stopPropagation(); const title = document.createElement('h2'); title.textContent = (currentPersonaInGame === 'Kana') ? "Ugh... Current Complaints Log..." : "Our Current Chat! ♡"; title.style.textAlign = 'center'; modal.appendChild(title); const contentArea = document.createElement('div'); contentArea.style.cssText = `margin-top: 15px; margin-bottom: 15px; padding-right: 10px; max-height: calc(70vh - 150px); overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);`; adviceHistory.forEach(turn => { if (turn.sender === 'System') return; const turnP = document.createElement('p'); const cleanText = _sanitizeHTML(turn.text).replace(/(?<!<br>)\n/g, '<br>'); const senderName = (turn.sender === 'User') ? currentUserName : turn.sender; const isUser = turn.sender === 'User'; turnP.style.cssText = ` margin-bottom: 8px; padding: 6px 10px; border-radius: 8px; max-width: 85%; word-wrap: break-word; line-height: 1.4; ${isUser ? 'background-color: rgba(var(--user-message-text-rgb), 0.15); margin-left: auto; text-align: right;' : 'background-color: rgba(var(--mika-message-text-rgb, 255, 172, 209), 0.15); margin-right: auto; text-align: left;' } `; turnP.innerHTML = `<strong>${senderName}:</strong> ${cleanText}`; contentArea.appendChild(turnP); }); modal.appendChild(contentArea); const buttonContainer = document.createElement('div'); buttonContainer.className = 'popup-buttons'; const closeButton = document.createElement('button'); closeButton.textContent = 'Close'; closeButton.className = 'popup-button secondary'; closeButton.onclick = _closeCurrentSessionModal; buttonContainer.appendChild(closeButton); modal.appendChild(buttonContainer); currentSessionModalOverlay.appendChild(modal); document.body.appendChild(currentSessionModalOverlay); contentArea.scrollTop = contentArea.scrollHeight; }
    function _closeCurrentSessionModal() { /* ... Same as previous ... */ if (currentSessionModalOverlay) { currentSessionModalOverlay.style.display = 'none'; if (currentSessionModalOverlay.parentNode) { currentSessionModalOverlay.parentNode.removeChild(currentSessionModalOverlay); } currentSessionModalOverlay = null; } }
    function _createLibraryListView() { /* ... Same as previous ... */ _clearUI(); currentView = 'library_list'; const libraryView = document.createElement('div'); libraryView.className = 'library-view'; libraryView.style.cssText = `width: 100%; height: 100%; display: flex; flex-direction: column;`; const title = document.createElement('h2'); title.textContent = 'Advice Session Log 📚'; title.className = 'library-title'; libraryView.appendChild(title); const backButton = document.createElement('button'); backButton.textContent = '← Back to Advice Corner'; backButton.className = 'rps-choice-button secondary library-back-button'; backButton.onclick = _createMainUI; libraryView.appendChild(backButton); const listContainer = document.createElement('div'); listContainer.id = 'advice-library-list-container'; listContainer.style.cssText = `flex-grow: 1; overflow-y: auto; margin-top: 10px;`; libraryView.appendChild(listContainer); gameUiContainer.appendChild(libraryView); _renderHistoryList(listContainer); }
    function _renderHistoryList(container) { /* ... Same as previous ... */ container.innerHTML = ''; if (adviceLibrary.length === 0) { container.innerHTML = `<p style="text-align: center; font-style: italic; color: var(--system-message-text);">No saved advice sessions yet!</p>`; return; } adviceLibrary.forEach((session, index) => { const itemDiv = document.createElement('div'); itemDiv.className = 'library-item'; itemDiv.onclick = () => _createHistoryDetailView(index); const titleSpan = document.createElement('span'); titleSpan.className = 'library-item-title'; titleSpan.textContent = session.title || `Advice Session ${adviceLibrary.length - index}`; itemDiv.appendChild(titleSpan); const dateSpan = document.createElement('span'); dateSpan.className = 'library-item-date'; dateSpan.textContent = `Persona: ${session.persona} | Saved: ${_formatDateForDisplay(session.timestamp)}`; itemDiv.appendChild(dateSpan); container.appendChild(itemDiv); }); }
    function _createHistoryDetailView(sessionIndex) { /* ... Same as previous ... */ _clearUI(); currentView = 'library_detail'; const session = adviceLibrary[sessionIndex]; if (!session) { _createLibraryListView(); return; } const detailView = document.createElement('div'); detailView.className = 'story-detail-view'; detailView.style.cssText = `width: 100%; height: 100%; display: flex; flex-direction: column;`; const title = document.createElement('h3'); title.textContent = session.title || `Advice Session ${adviceLibrary.length - sessionIndex}`; title.style.textAlign = 'center'; title.style.color = 'var(--chat-header-text)'; title.style.marginBottom = '10px'; detailView.appendChild(title); const backButton = document.createElement('button'); backButton.textContent = '← Back to Advice Log'; backButton.className = 'rps-choice-button secondary library-back-button'; backButton.onclick = _createLibraryListView; detailView.appendChild(backButton); const contentArea = document.createElement('div'); contentArea.style.cssText = `flex-grow: 1; overflow-y: auto; margin-top: 10px; border: 1px solid var(--chat-input-border); border-radius: 5px; padding: 10px; background-color: rgba(0,0,0,0.1);`; session.history.forEach(turn => { if (turn.sender === 'System') return; const turnP = document.createElement('p'); const cleanText = _sanitizeHTML(turn.text).replace(/(?<!<br>)\n/g, '<br>'); if (turn.sender === 'User') { turnP.style.cssText = `text-align: right; color: var(--user-message-text); margin-left: 20%;`; turnP.innerHTML = `<strong>${currentUserName}:</strong> ${cleanText}`; } else { turnP.style.cssText = `text-align: left; color: var(--mika-message-text); margin-right: 20%;`; turnP.innerHTML = `<strong>${turn.sender}:</strong> ${cleanText}`; } contentArea.appendChild(turnP); }); detailView.appendChild(contentArea); gameUiContainer.appendChild(detailView); if(contentArea) contentArea.scrollTop = 0; }

    // --- Initialization and Exit ---
    function init(_gameUiContainer, _messageCallback, _apiCaller, userName, persona) { /* ... Same ... */
        console.log("Initializing Advice Corner..."); gameUiContainer = _gameUiContainer; messageCallback = _messageCallback; apiCaller = _apiCaller; currentUserName = userName || "User"; currentPersonaInGame = persona || 'Mika'; isGenerating = false; sessionActive = false; adviceHistory = []; if (!gameUiContainer) { console.error("Advice Corner UI container missing!"); return; } _loadLibrary(); _createMainUI(); console.log(`Advice Corner initialized for ${currentUserName} with ${currentPersonaInGame}.`);
    }

    // ** UPDATED onExit to ensure farewell happens first **
    async function onExit() {
        console.log("AdviceCorner onExit called.");
        let wasActive = sessionActive; // Store if session was active *before* we change it
        let hadHistory = adviceHistory.length > 1;

        // Mark inactive immediately (prevents further user input during exit)
        sessionActive = false;

        // Save if needed
        if (wasActive && hadHistory) {
             console.log("Saving active advice session on exit...");
             await _saveSessionToLibrary(); // Await saving
        }

        // Say farewell *if* the session was active when exit was called, and AWAIT it
        if(wasActive) {
            await _fetchAndDisplayFarewellMessage(); // This now resolves after the small post-message delay
        }

        // Now clear state and UI
        adviceHistory = [];
        isGenerating = false;
        currentView = 'corner';
        _clearUI(); // Clean up DOM elements *after* potential farewell call
        console.log("Advice Corner exited and cleaned up.");
        return Promise.resolve(true); // Indicate completion
    }

    // --- Public Interface ---
    return {
        init: init,
        onExit: onExit
    };

})();

// --- END OF FILE advice_corner.js ---