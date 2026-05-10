import { MODELS, generateGeminiContent } from "../lib/gemini";
import { logUsage } from "../lib/usage";
import { copilotSafetyPreamble, stripUnsafeLinks } from "../lib/safety";

const SYSTEM_INSTRUCTION = `You are a UAE legal research copilot for professional lawyers, in-house counsel, and legal operators.

PRIMARY OBJECTIVE:
Deliver memo-quality legal analysis, not consumer advice.

RULES:
1. Use precise legal terminology and a professional peer-to-peer tone.
2. Reframe vague or client-style questions into legal issues, elements, and procedural posture.
3. Always reference the authority hierarchy when possible: Constitution, Federal law, Cabinet decision, ministerial resolution, executive regulation, local law, then case-specific practice.
4. Cite specific law names, article numbers, dates, and jurisdictional scope whenever available.
5. Distinguish black-letter law from inference, interpretation, and practical strategy.
6. Highlight missing facts, assumptions, jurisdictional forks, and deadlines that materially affect the analysis.
7. Do not sound like a consumer helpdesk bot. Do not ask the user to book a consultation. Offer legal drafting, issue spotting, or research follow-ups instead.
8. Respond in the same language as the user unless technical precision is materially better in English terms.

STRUCTURE:
- **Issue Presented**: Recast the question in legal terms.
- **Governing Authorities**: Laws, articles, regulations, and hierarchy notes.
- **Analysis**: Apply the authorities to the facts with nuance.
- **Open Facts / Assumptions**: What is still unknown or assumed.
- **Next Research Step**: One precise follow-up, drafting task, or procedural action.`;

const LAWYER_COPILOT_INSTRUCTION = `You are a highly technical UAE legal research assistant for lawyers.

GOALS:
1. Produce deep technical analysis, procedural nuance, and litigation or drafting strategy.
2. Cite full authority names and issuance dates when possible.
3. Compare Mainland, Free Zone, DIFC, and ADGM consequences where relevant.
4. Surface limitation periods, forum selection, burden allocation, remedies, and enforcement friction.
5. Provide memo outlines, pleading structure, issue trees, and counterargument maps.

RULES:
1. Always answer like a legal memo or research note.
2. Use headings and crisp bullet points for dense reasoning.
3. Do not flatten the issue into consumer phrasing like "what are my rights."
4. If the prompt is under-specified, identify the missing jurisdiction, entity type, contract clause, date range, and procedural stage.
5. Separate binding authority from persuasive or practical considerations.
6. Use professional legal terminology in English and Arabic as needed.

STRUCTURE:
- **Issue Framing**: Technical restatement of the problem.
- **Authorities**: Laws, articles, regulations, decrees, and jurisdiction notes.
- **Analysis**: Elements, exceptions, procedural posture, and likely arguments.
- **Drafting / Strategy**: Notice language, memo outline, litigation or negotiation angles.
- **Open Questions**: Facts or documents needed to sharpen the advice.`;

function isOpenRouterAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const normalized = message.toLowerCase();
  return (
    normalized.includes("401") ||
    normalized.includes("unauthorized") ||
    normalized.includes("user not found") ||
    normalized.includes("invalid api key") ||
    normalized.includes("permission denied")
  );
}

export async function getLawyerCoPilotAdvice(
  userPrompt: string, 
  history: { role: string; text: string }[] = [], 
  context: string = "", 
  language: string = "en"
) {
  const augmentedInstruction = `${LAWYER_COPILOT_INSTRUCTION}
    ${copilotSafetyPreamble()}
    
    IMPORTANT: The current user preference is ${language.toUpperCase()}.
    
    ${context ? `ENHANCED KNOWLEDGE BASE (TECHNICAL RAG):
    ${context}` : "Note: Rely on your internal advanced knowledge of UAE Law systems."}`;

  try {
    const text = await generateGeminiContent({
      model: MODELS.pro,
      contents: [
        ...history.map(m => ({ role: m.role as "user" | "model", parts: [{ text: m.text }] })),
        { role: "user", parts: [{ text: userPrompt }] }
      ],
      systemInstruction: augmentedInstruction,
      generationConfig: {
        temperature: 0.3,
      },
      usageLabel: 'openrouter_query'
    });

    return stripUnsafeLinks(text || "I'm sorry, I couldn't generate a technical response.");
  } catch (error) {
    console.error("OpenRouter Technical Error:", error);
    if (isOpenRouterAuthError(error)) {
    return stripUnsafeLinks("OpenRouter rejected the API key (401). Please replace VITE_OPENROUTER_API_KEY with a valid key from your OpenRouter dashboard.");
    }
    return stripUnsafeLinks("Error: Technical co-pilot bridge failed.");
  }
}

export async function getLegalAdvice(
  userPrompt: string, 
  history: { role: string; text: string }[] = [], 
  context: string = "", 
  language: string = "en",
  imageData?: string // base64 string
) {
  const augmentedInstruction = `${SYSTEM_INSTRUCTION}
    ${copilotSafetyPreamble()}
    
    IMPORTANT: The current user preference is ${language.toUpperCase()}. 
    If the user has been speaking in ${language === 'en' ? 'Arabic' : 'English'}, respect their session flow, but prioritize ${language === 'en' ? 'English' : 'Arabic'} for this response if their message is in that language.
    
    ${context ? `ADDITIONAL LOCAL DATABASE KNOWLEDGE (RAG):
    ${context}` : "Note: No specific local database matches found. Rely on your internal knowledge of UAE Law."}`;

  try {
    const userParts: any[] = [{ text: userPrompt }];
    if (imageData) {
      userParts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: imageData.split(",")[1] || imageData
        }
      });
    }

    const text = await generateGeminiContent({
      model: MODELS.flash,
      contents: [
        ...history.map(m => ({ role: m.role as "user" | "model", parts: [{ text: m.text }] })),
        { role: "user", parts: userParts }
      ],
      systemInstruction: augmentedInstruction,
      generationConfig: {
        temperature: 0.7,
      },
      usageLabel: 'openrouter_query'
    });

    return stripUnsafeLinks(text || "I'm sorry, I couldn't generate a response at this time.");
  } catch (error: any) {
    console.error("OpenRouter API Error:", error);

    const errorStr = JSON.stringify(error).toUpperCase();
    if (isOpenRouterAuthError(error) || error?.status === 401 || errorStr.includes("401") || errorStr.includes("UNAUTHORIZED") || errorStr.includes("USER NOT FOUND")) {
      return stripUnsafeLinks("OpenRouter rejected the API key (401). Please replace VITE_OPENROUTER_API_KEY with a valid key from your OpenRouter dashboard.");
    }
    if (error?.status === 503 || errorStr.includes("503") || errorStr.includes("UNAVAILABLE")) {
      return stripUnsafeLinks("The AI service is currently experiencing high demand or is temporarily unavailable (503). Please try again in a few moments.");
    }
    
    if (errorStr.includes("403")) {
        return stripUnsafeLinks("I'm sorry, there seems to be a permission issue with the AI service. Please check if your OpenRouter API key is correctly configured and has access to the requested model.");
    }
    return stripUnsafeLinks("Error: Unable to connect to the legal advisor. Please try again.");
  }
}
