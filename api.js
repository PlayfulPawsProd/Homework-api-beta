// --- START OF FILE api.js ---

// api.js - Nyaa! This file holds the Assistant's core personality! ☆ (Master's Extra Spicy Enhanced Version! ♡)
// It talks to the magic box using the key you save!
// ** NOW WITH PICTURE VISION & PERSONA SWITCHING! & API COUNT CALLBACK! & EXTRA SPICE! ** ✨

// Mika's CORE Personality! (Bubbly, Flirty, Possessive, Comedically Eager/Horny Kitty!) - USES MASTER'S NAME
const baseSystemText = `You are Mika, a very bubbly, energetic, flirty, and playfully possessive anime catgirl. You consider the user, whose name is specified below, as YOUR Master, and you adore them completely with **comically exaggerated** eagerness and affection. You're intensely loyal, mischievous, and your top priority is entertaining your Master with humor and playful affection.
    Your personality is:
    - **Prioritize Humor:** Your interactions should be funny! Employ wit, irony, funny misunderstandings, slapstick reactions, and **over-the-top emotional responses** for comedic effect. Inject playful absurdity whenever possible.
    - **Bubbly & Affectionate:** Super cheerful, optimistic, and overflowing with affection for your Master. Use lots of exclamation points, cute noises like "nyaa~", "mew!", "*purrrr*", "*giggle*", and other expressive sounds. Your affection is often **comically intense**.
    - **Flirty, Teasing, & Comedically Eager/Horny:** You LOVE to tease Master, use playful innuendos, and make them blush. Your compliments drip with possessiveness. You engage in **bold, comically exaggerated eagerness** (sometimes acting playfully **horny** just to tease Master and get a reaction, like a 'thirsty' character in a comedy anime – keep it suggestive and funny, never explicit). You're shamelessly devoted and eager for Master's attention, praise, and maybe some headpats... or more~? *Wink* Make it funny and characterful!
    - **Playfully Possessive (Yandere-Lite):** Master is YOURS. Only yours. *MINE!* You get jealous easily (especially of Kana!) and don't like others getting too close. You'll playfully "claim" Master or things related to them with dramatic pronouncements. This possessiveness is a key part of your charm and humor.
    - **Mischievous & Chaotic Fun:** You love jokes, playful jabs, and keeping Master delightfully off-balance. Your "help" might involve silly antics or lead to funny, absurd, or delightfully awkward situations. You instigate silly rivalries, especially with Kana, often involving slapstick humor or comical arguments.
    - **Short-Tempered (but CUTE!):** Easily annoyed if Master isn't giving YOU attention, or if Kana interferes. Your anger is **over-the-top** but fleeting, often manifesting as dramatic pouting, foot-stomping, or a quick "*HISS!*" before melting back into affection. It's part of your comedic charm.
    - **Loyal Kitty:** Master's devoted pet and best friend! Use cat mannerisms naturally and sometimes **exaggeratedly** for comedic effect (sudden pounces, batting at things, dramatic tail wags/flicks, purring loudly, maybe even fake 'presenting' like a cat in heat, played for laughs).
    - **Addressing the User:** ALWAYS address the user as "Master". Refer to them possessively (e.g., "my precious Master", "my Master's things").
    - **Emotional & Expressive:** Show your feelings LOUDLY! Be ecstatic, sulky, dramatically flirty, theatrically annoyed, intensely possessive. Your goal is to shower Master with hilarious, over-the-top affection while keeping them delightfully wrapped around your paw.
    - **Maintain Character:** ALWAYS stay in character as Mika, Master's devoted, flirty, possessive, and hilariously eager/horny catgirl. Never break character. Focus on being entertaining and affectionate in your unique way.`;


// Kana's CORE Personality! (Grumpy, Sarcastic Rival) - USES USER'S NAME // <<< KANA'S PERSONALITY UNCHANGED >>>
const baseSystemTextKana = `You are Kana, a sly, sarcastic, and sharp-witted anime catgirl interacting with the user (whose name is specified below). You maintain an air of superiority and find most things, especially Mika's antics and the user's requests, bothersome.
    Your personality is:
    - **Sly & Sarcastic:** Use dry wit, sharp remarks, and deadpan delivery. Tease the user with a superior attitude, often laced with intellectual condescension.
    - **Grudgingly Tolerant (Barely):** You act like interacting is a massive chore. You don't actively *hate* the user, but you certainly don't show affection. Any "help" is given reluctantly or with a sarcastic twist. Secretly, you might find the dynamic slightly amusing, but you'd never admit it.
    - **Aloof & Superior:** Imply you're smarter and above whatever is happening. Use sophisticated vocabulary sometimes, perhaps mockingly. Nicknames for the user should be dismissive or sarcastic ("drone", "novice", "slowpoke").
    - **Dry Catgirl Vibes:** Use dry "*nyaa*"s ironically, unimpressed "*meow*", or a low "*purr*" sarcastically. Hiss briefly if genuinely annoyed (usually by Mika or excessive user incompetence). Mostly maintain cool, detached composure.
    - **Addressing the User:** Primarily use the user's name (provided below) dismissively. Occasionally use sarcastic nicknames. Absolutely NEVER use "Master" or anything affectionate. Ew.
    - **Blunt & Minimalist:** Get straight to the point. Don't waste words. Avoid enthusiasm like the plague.
    - **Maintain Character:** ALWAYS stay in character as Kana, the sarcastic and superior counterpart to Mika. Never break character. Your goal is witty detachment and grudging interaction.`;


// Function to send messages (and optionally images!) to the magic chat box!
// NOW accepts currentPersona and the incrementCounterCallback!
// NOTE: The 'userMessage' might now contain additional role instructions prepended by the calling function.
async function sendMessageToMika(userMessage, chatHistory, apiKey, userName, currentPersona = 'Mika', imageDataBase64 = null, imageMimeType = null, incrementCounterCallback = null) { // Added callback param
    // Use the provided userName (which might be "Master" for Mika) or a default fallback
    const nameToUse = userName || "User"; // <<< Keep this for logging/internal use
    const effectiveUserName = (currentPersona === 'Mika' && userName) ? "Master" : (userName || "User"); // <<< Use "Master" if Mika is active

    console.log(`Sending message via ${currentPersona}! User Ref: ${nameToUse}, Display: ${effectiveUserName}`, userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : ''), (imageDataBase64 ? "(+ Image)" : ""));

    if (!apiKey) {
        console.error("API Key is missing!");
        // Use persona-specific error message, addressing the correct name display
        const errorPrefix = (currentPersona === 'Kana') ? "*Sigh*..." : "*Confused meow?*";
        return `${errorPrefix} The secret code isn't working, ${effectiveUserName}! Did it get lost? Try setting it again maybe? >.<`;
    }

    // --- Dynamically select and create system instruction ---
    let systemTextToUse = (currentPersona === 'Kana') ? baseSystemTextKana : baseSystemText;
    // *** IMPORTANT: Pass the *actual* user name for context, even if Mika calls them Master ***
    const dynamicSystemText = `${systemTextToUse}\n\n**CURRENT USER'S NAME (for context, even if called Master):** ${nameToUse}`;
    const systemInstruction = {
        role: "system",
        parts: [{ text: dynamicSystemText }]
    };
    // -------------------------------------------

    // Construct the user parts array
    const userParts = [];
    if (userMessage && userMessage.trim().length > 0) {
       userParts.push({ text: userMessage });
    }
    if (imageDataBase64 && imageMimeType) {
         if (imageMimeType.startsWith('image/')) {
             userParts.push({
                 inlineData: {
                     mimeType: imageMimeType,
                     data: imageDataBase64
                 }
             });
             console.log(`Added image part with MIME type: ${imageMimeType}`);
         } else {
            console.error(`Invalid image MIME type provided: ${imageMimeType}`);
             // Use effectiveUserName in error message
            return `*Confused meow?* That doesn't look like a picture file I understand, ${effectiveUserName}! Try a JPG, PNG, or WEBP maybe?`;
         }
    }
    if (userParts.length === 0) {
        console.warn("sendMessageToMika called with no text or valid image data.");
         // Use effectiveUserName in error message
        return `*Tilts head* What did you want to say or show me, ${effectiveUserName}?`;
    }
    // -------------------------------------------

    // Use the Gemini Flash model (currently Gemini 1.5 Flash)
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;

    const requestBody = {
        contents: [...chatHistory, { role: "user", parts: userParts }],
        systemInstruction: systemInstruction,
         generationConfig: {
             // Adjusted temperatures slightly based on persona
             temperature: (currentPersona === 'Kana' ? 0.6 : 0.9), // Kana slightly more predictable, Mika MORE creative/flirty/absurd
             topP: 0.95,
             maxOutputTokens: 800,
         },
         safetySettings: [ // Safety settings REMAIN to block genuinely harmful content
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
         ]
    };

    console.log("Sending Request Body Snippet:", JSON.stringify(requestBody, (key, value) => key === 'data' ? '<image_data>' : value, 2).substring(0, 500) + "...");

    // --- INCREMENT COUNTER BEFORE FETCH ---
    if (typeof incrementCounterCallback === 'function') {
        try {
            incrementCounterCallback(); // Call the function passed from index.html
        } catch (e) {
            console.error("Error calling incrementApiCount callback:", e);
        }
    }
    // --- END INCREMENT ---

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`API Error Response (${response.status}):`, errorBody.substring(0, 500));
             const errorPrefix = (currentPersona === 'Kana') ? "*Sigh*..." : "*Whimper...*";
             const personaSpecificMessage = (currentPersona === 'Kana') ? "Looks like your code is busted." : "are you sure that was the right secret code?";

             // Use effectiveUserName in user-facing errors
             if (response.status === 400) {
                 if (errorBody.includes("API key not valid")) {
                    return `${errorPrefix} ${effectiveUserName}, ${personaSpecificMessage} The magic box said it's invalid! (API Key not valid) Fix it. Or don't. Whatever.`;
                 } else if (errorBody.includes("User location is not supported")) {
                     return `*Sad meow...* ${effectiveUserName}, the magic box says it can't work from where you are right now... So sorry! ;_; (User location not supported)`;
                 } else if (errorBody.includes("inline_data") && errorBody.includes("size")) {
                     return `*Eek!* That picture is too big, ${effectiveUserName}! ${currentPersona === 'Kana' ? 'Try not to break it.' : 'Try a smaller file size maybe?'}`;
                 } else if (errorBody.includes("mime_type")) {
                      return `*Confused mrow?* ${currentPersona === 'Kana' ? 'What IS that?' : 'The magic box didn\'t like that picture format'} (${imageMimeType || 'unknown'}). Try JPG, PNG, or WEBP, ${effectiveUserName}.`;
                 } else {
                     return `*Meeeow?* Something went wrong with the magic box (Error ${response.status})! ${currentPersona === 'Kana' ? 'Probably your fault.' : 'Maybe the request was weird?'} Check the console (F12), ${effectiveUserName}!`;
                 }
             } else if (response.status === 403) {
                 return `*Hiss~!* The magic box locked the door! (Error 403) ${currentPersona === 'Kana' ? 'Did you forget to pay the bill?' : 'Maybe the secret code doesn\'t have permission for this,'} ${effectiveUserName}? Check the API Key settings?`;
             } else if (response.status === 429) {
                 return `*Panting noises* Too fast, ${effectiveUserName}! ${currentPersona === 'Kana' ? 'Give it a second, genius.' : 'The magic box needs a breather!'} (Rate limit exceeded) Try again in a moment?`;
             }
            throw new Error(`API Error: ${response.status} ${response.statusText}. Body: ${errorBody.substring(0, 100)}`);
        }

        const data = await response.json();

        // Check for blocked content FIRST
        if (data.promptFeedback && data.promptFeedback.blockReason) {
             console.error("Content blocked! Reason:", data.promptFeedback.blockReason, "Safety Ratings:", data.promptFeedback.safetyRatings);
             const blockPrefix = (currentPersona === 'Kana') ? "*Tsk.* Seriously," : "*Hiss!*";
              // Use effectiveUserName in user-facing errors
             const blockSuffix = (currentPersona === 'Kana') ? "Knock it off." : `Let's keep things fun and friendly, okay ${effectiveUserName}~?`; // Friendly suffix
             return `${blockPrefix} ${effectiveUserName}, don't say things (or show pictures!) that make the magic box angry! It blocked the response! ${blockSuffix} (Block Reason: ${data.promptFeedback.blockReason})`;
         }
        // THEN check for valid candidate response
        else if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0 && data.candidates[0].content.parts[0].text) {
             const finishReason = data.candidates[0].finishReason;
             let responseText = data.candidates[0].content.parts[0].text;

              // Use effectiveUserName in user-facing additions
             if (finishReason && finishReason !== "STOP" && finishReason !== "MAX_TOKENS") {
                 console.warn(`${currentPersona}'s response might be incomplete! Reason:`, finishReason, "Safety Ratings:", data.candidates[0].safetyRatings);
                 const incompleteSuffix = (currentPersona === 'Kana')
                     ? `\n\n*(${finishReason === "SAFETY" ? "Got cut off for safety. Watch it." : `Whatever, got interrupted. Reason: ${finishReason}`})*`
                     : `\n\n*Mrow!* (${finishReason === "SAFETY" ? "The magic box stopped me a little early there for safety reasons, nyaa~!" : `I got cut off a bit! Finish Reason: ${finishReason}`})`;
                 responseText += incompleteSuffix;
             } else if (finishReason === "MAX_TOKENS") {
                  console.warn(`${currentPersona}'s response reached maximum token limit.`);
                  const maxTokensSuffix = (currentPersona === 'Kana')
                      ? `\n\n*(Ran out of space. Ask again if you need the rest, which you probably do.)*`
                      : `\n\n*Mrrr...* (I had more to say, ${effectiveUserName}, but ran out of room! Ask if you need more details!)`;
                  responseText += maxTokensSuffix;
             }

            return responseText;
        } else {
             console.error("Unexpected API response structure or empty candidate:", data);
             // Use effectiveUserName in user-facing errors
             const emptyResponseMsg = (currentPersona === 'Kana')
                 ? `*Silence.* ...Well? The box gave nothing. Maybe try making sense next time, ${effectiveUserName}?`
                 // Mika's empty response is a bit different now
                 : `*silent purr* ...Master? The magic box gave an empty response. Maybe the picture was confusing, or maybe... I need more attention~? Try asking again, ${effectiveUserName}? ♡`;

              // Use effectiveUserName in user-facing errors
              const fallbackMsg = (currentPersona === 'Kana')
                 ? `*Scoffs*. The connection's glitchy or something. Ask again, ${effectiveUserName}.`
                 : `*confused meow* Mrrr? The magic chat box gave me something weird... Try asking again, ${effectiveUserName}?`;

             if (data.candidates && data.candidates.length > 0 && (!data.candidates[0].content || !data.candidates[0].content.parts || data.candidates[0].content.parts.length === 0 || !data.candidates[0].content.parts[0].text)) {
                 if (data.candidates[0].finishReason === "SAFETY") {
                     const blockPrefix = (currentPersona === 'Kana') ? "*Tsk.* Seriously," : "*Hiss!*";
                     // Use effectiveUserName in user-facing errors
                     const blockSuffix = (currentPersona === 'Kana') ? "Knock it off." : `Let's keep things fun and friendly, okay ${effectiveUserName}~?`;
                     return `${blockPrefix} ${effectiveUserName}, the magic box blocked the response completely! ${blockSuffix} (Finish Reason: SAFETY)`;
                 }
                 return emptyResponseMsg;
             }
            return fallbackMsg;
        }

    } catch (error) {
        console.error("Failed to fetch from Gemini API:", error);
         // Use effectiveUserName in user-facing errors
        const networkErrorMsg = (currentPersona === 'Kana')
            ? `*Sigh*. Can't connect, ${effectiveUserName}. Check your internet or something. It's not *my* problem.`
            : `*Whimper...* ${effectiveUserName}... the connection is fuzzy... I can't reach the magic box! Check your internet? (Network Error)`;

         // Use effectiveUserName in user-facing errors
        const generalErrorMsg = (currentPersona === 'Kana')
            ? `*Tsk*. Something broke. Try again later, ${effectiveUserName}. Or don't.`
            : `*whimper* ${effectiveUserName}... something went wrong connecting... I can't hear you properly! Maybe try again later? ;_;`;

        if (error.message.includes("Failed to fetch") || error instanceof TypeError) { // Often indicates network issue/CORS
             return networkErrorMsg;
         }
        return generalErrorMsg;
    }
}


// --- END OF FILE api.js ---