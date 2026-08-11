/**
 * Job Extension Controller
 * Routes AI tasks (Email Gen, Interview Prep, Job Parse) to n8n Webhook (GPT-4o-Mini)
 * Webhook URL: https://n8n.glowradius.com/webhook-test/generate-output
 *
 * Falls back gracefully to Gemini SDK if n8n Webhook is unavailable.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://n8n.glowradius.com/webhook/generate-output';

const MODEL_CANDIDATES = [
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.6-flash"
];

/**
 * Call n8n Webhook (GPT-4o-Mini) with prompt payload
 */
async function callN8nWebhook(payload) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL || N8N_WEBHOOK_URL;
  console.log(`[n8n Webhook] Calling webhook: ${webhookUrl} (action: ${payload.action})`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort('Timeout: n8n webhook took longer than 45s'), 45000);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`n8n Webhook returned HTTP ${response.status}: ${errText.substring(0, 200)}`);
    }

    const resData = await response.json();
    return parseN8nResponse(resData);
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`[n8n Webhook Notice] ${err.message}`);
    throw err;
  }
}

/**
 * Parse output returned from n8n OpenAI node
 */
function parseN8nResponse(n8nOutput) {
  if (!n8nOutput) {
    throw new Error('Empty response received from n8n Webhook.');
  }

  // Handle array output from n8n
  let data = Array.isArray(n8nOutput) ? n8nOutput[0] : n8nOutput;

  // Handle nested n8n OpenAI node output formats
  if (data.output) data = data.output;
  if (data.message && data.message.content) data = data.message.content;
  if (data.response) data = data.response;

  // If already a parsed object with expected keys
  if (typeof data === 'object' && data !== null) {
    return data;
  }

  // If string, parse clean JSON
  if (typeof data === 'string') {
    return parseCleanJson(data);
  }

  return data;
}

/**
 * Call Gemini AI using official @google/generative-ai SDK as fallback
 */
async function callGeminiSDK(promptText, systemInstruction, apiKey) {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('Gemini API key is required for fallback.');
  }

  const genAI = new GoogleGenerativeAI(apiKey.trim());
  let lastError = null;

  for (const modelName of MODEL_CANDIDATES) {
    try {
      const modelConfig = {
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json"
        }
      };

      if (systemInstruction) {
        modelConfig.systemInstruction = systemInstruction;
      }

      const model = genAI.getGenerativeModel(modelConfig);
      const result = await model.generateContent(promptText);
      const text = result.response.text();

      if (text && text.trim().length > 0) {
        return { text, modelUsed: modelName };
      }
    } catch (err) {
      console.warn(`[Gemini Fallback SDK] Model ${modelName} notice: ${err.message.substring(0, 150)}`);
      lastError = err;
    }
  }

  throw lastError || new Error('All Gemini AI models in cascade failed to respond.');
}

/**
 * Fix unescaped backslashes in AI JSON output
 */
function fixInvalidJsonEscapes(str) {
  return str.replace(/\\(?:[^"\\/bfnrtu]|u(?![0-9a-fA-F]{4}))/g, (match) => {
    return '\\\\' + match.slice(1);
  });
}

/**
 * Robust JSON output parser
 */
function parseCleanJson(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Empty string received from AI model.');
  }

  let cleanStr = text.replace(/^```json\n?/i, '').replace(/^```\n?/, '').replace(/\n?```$/, '').trim();

  const firstBrace = cleanStr.indexOf('{');
  const lastBrace = cleanStr.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
    cleanStr = cleanStr.substring(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleanStr);
  } catch (initialErr) {
    try {
      let sanitized = fixInvalidJsonEscapes(cleanStr)
        .replace(/,\s*([\}\]])/g, '$1')
        .replace(/\r\n/g, '\\n')
        .replace(/\t/g, '\\t');

      return JSON.parse(sanitized);
    } catch (secondErr) {
      try {
        let repaired = fixInvalidJsonEscapes(cleanStr)
          .replace(/,\s*([\}\]])/g, '$1')
          .replace(/,\s*"[^"]*"?\s*:\s*"?[^"]*$/s, '');

        const openBraces = (repaired.match(/\{/g) || []).length;
        const closeBraces = (repaired.match(/\}/g) || []).length;
        const openBrackets = (repaired.match(/\[/g) || []).length;
        const closeBrackets = (repaired.match(/\]/g) || []).length;

        for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
        for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';

        return JSON.parse(repaired);
      } catch (finalErr) {
        throw new Error(`JSON parse failed: ${initialErr.message}. Output snippet: ${cleanStr.substring(0, 150)}...`);
      }
    }
  }
}

/**
 * Controller: Generate Tailored Cold Application Email Draft
 * Endpoint: POST /api/job-extension/generate-email
 */
exports.generateEmail = async (req, res) => {
  try {
    const { job, candidateCv, apiKey } = req.body;

    if (!job || (!job.jobTitle && !job.detailedOverview && !job.rawTextCaptured)) {
      return res.status(400).json({ error: 'Job circular details (jobTitle / raw text) are required.' });
    }

    const candidateName = candidateCv?.candidateName || 'Candidate';
    const candidateEmail = candidateCv?.contactEmail || '';
    const candidateSkills = Array.isArray(candidateCv?.extractedSkills)
      ? candidateCv.extractedSkills.join(', ')
      : (candidateCv?.extractedSkills || '');

    const systemInstruction = `You are a world-class Executive Copywriter and Senior Technical Recruiter.
Your mission is to write a 100% custom, highly persuasive, 4-paragraph cold job application email draft based STRICTLY on the provided JOB CIRCULAR DETAILS and CANDIDATE CV DETAILS.

CRITICAL MASTER PROMPT RULES:
1. **Zero Fabrication & Absolute Truthfulness**: Cross-reference candidate's CV against the job circular requirements. ONLY highlight skills, tools, and experience that the candidate ACTUALLY possesses in their CV. If the candidate lacks a specific requirement from the circular, acknowledge it honestly and frame it around fast adaptability or related experience.
2. **Dynamic & Non-repetitive**: Do NOT use generic template placeholders or fixed text. Write a completely fresh, compelling email tailored to this exact candidate and company.
3. **Structure**:
   - Paragraph 1 (Opening): Direct, energetic opening stating interest in the exact role and company.
   - Paragraph 2 (Core Fit): Direct mapping of candidate's past achievements & core technical experience to the job's core challenges.
   - Bullet Points: 3-5 specific technical accomplishments strictly from candidate's CV matching job requirements.
   - Paragraph 4 (Closing & Call to Action): Professional call to action, mentioning attached CV and relevant portfolio/GitHub/LinkedIn links.

Ensure the final email naturally incorporates candidate's links:
GitHub: ${candidateCv?.githubUrl || 'N/A'}
Portfolio: ${candidateCv?.portfolioUrl || 'N/A'}
LinkedIn: ${candidateCv?.linkedinUrl || 'N/A'}

OUTPUT REQUIREMENT:
Return STRICT, VALID JSON ONLY with exact structure:
{
  "subject": "Compelling subject line tailored to the job title and company",
  "emailBody": "Full 4-paragraph email body formatted with line breaks"
}`;

    const promptText = `JOB CIRCULAR DETAILS:
Title: ${job.jobTitle || 'N/A'}
Company: ${job.companyName || 'N/A'}
Required Skills: ${Array.isArray(job.requiredSkills) ? job.requiredSkills.join(', ') : job.requiredSkills || 'N/A'}
Responsibilities: ${Array.isArray(job.responsibilities) ? job.responsibilities.join('\n') : job.responsibilities || 'N/A'}
Qualifications: ${Array.isArray(job.qualifications) ? job.qualifications.join('\n') : job.qualifications || 'N/A'}
Overview / Circular Text: ${job.detailedOverview || job.rawTextCaptured || 'N/A'}

CANDIDATE CV DETAILS (SOURCE OF TRUTH):
Name: ${candidateName}
Email: ${candidateEmail}
Extracted Skills: ${candidateSkills}
GitHub: ${candidateCv?.githubUrl || 'N/A'}
Portfolio: ${candidateCv?.portfolioUrl || 'N/A'}
LinkedIn: ${candidateCv?.linkedinUrl || 'N/A'}
Full CV Text / Background:
${candidateCv?.rawCvText ? candidateCv.rawCvText.substring(0, 4000) : 'No raw CV text provided.'}`;

    // 1. Try Primary Provider: n8n Webhook (GPT-4o-Mini)
    try {
      const n8nResult = await callN8nWebhook({
        action: 'generate-email',
        prompt: `${systemInstruction}\n\n${promptText}`,
        systemInstruction,
        promptText,
        job,
        candidateCv
      });

      return res.json({
        success: true,
        provider: 'n8n GPT-4o-Mini',
        subject: n8nResult.subject || `Application for ${job.jobTitle || 'Role'} - ${candidateName}`,
        emailBody: n8nResult.emailBody || n8nResult.text || JSON.stringify(n8nResult)
      });
    } catch (n8nError) {
      console.warn('[JobExtensionController] n8n Webhook call failed, trying Gemini fallback:', n8nError.message);
    }

    // 2. Fallback Provider: Gemini SDK
    const effectiveApiKey = apiKey || process.env.GEMINI_API_KEY;
    const { text, modelUsed } = await callGeminiSDK(promptText, systemInstruction, effectiveApiKey);
    const parsed = parseCleanJson(text);

    return res.json({
      success: true,
      provider: `Gemini (${modelUsed})`,
      subject: parsed.subject || `Application for ${job.jobTitle || 'Role'} - ${candidateName}`,
      emailBody: parsed.emailBody || text
    });

  } catch (error) {
    console.error('[JobExtensionController] generateEmail error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate email template.'
    });
  }
};

/**
 * Controller: Generate Dynamic Technical Interview Questions
 * Endpoint: POST /api/job-extension/generate-interview-prep
 */
exports.generateInterviewPrep = async (req, res) => {
  try {
    const { job, candidateCv, apiKey } = req.body;

    if (!job || (!job.jobTitle && !job.rawTextCaptured && !job.detailedOverview)) {
      return res.status(400).json({ error: 'Job circular data (jobTitle or raw circular content) is required.' });
    }

    const systemInstruction = `You are a Principal Software Architect and Lead Technical Interviewer at a top technology company.
Your mission is to perform a comprehensive, deep technical analysis of the provided JOB CIRCULAR DETAILS and CANDIDATE CV, then generate a 100% DYNAMIC, ADVANCED MASTER TECHNICAL INTERVIEW PREPARATION GUIDE.

CRITICAL MASTER PROMPT RULES:
1. **Clean Skill-Based Categorization**: Identify every distinct technical skill required by the job circular (e.g., "Next.js", "React.js", "TypeScript", "Node.js", "GraphQL", "MongoDB", "System Architecture"). "skillName" MUST be SHORT and SPECIFIC to a single technical skill so each skill gets its own clean, dedicated tab.
2. **STRICT QUESTION COUNT REQUIREMENT (5 to 7 Questions Per Skill)**:
   - For EVERY SINGLE skill in "skillsPrepared", you MUST generate EXACTLY 5 to 7 advanced, scenario-based technical questions.
   - Generating only 1 or 2 questions per skill is STRICTLY FORBIDDEN.
3. **Candidate CV Cross-Reference & Personalization**:
   - Cross-reference the Candidate's CV against the job circular requirements.
   - Frame the "overviewAdvice" specifically around how the candidate can leverage their CV strengths to stand out and how to confidently answer questions on technologies from the circular that might be missing from their CV.
4. **Senior/Architect Level Technical Depth (NO BEGINNER QUESTIONS)**:
   - Questions MUST cover deep runtime mechanics, memory profiling, concurrency/race conditions, caching strategies (RSC, Redis, Edge), high-throughput database/GraphQL optimizations, security mitigations (JWT rotation, CORS, CSRF), and real-world production incident debugging.
5. **Question Format**: For EVERY question, include:
   - "id": sequential number (1, 2, 3...)
   - "category": specific sub-domain topic (e.g., Edge Middleware & Token Rotation)
   - "question": complex scenario-based technical question
   - "answer": comprehensive expert model answer explaining the underlying mechanics and trade-offs
   - "keyPoints": array of 3 precise verbal takeaways for an interview answer.

RETURN STRICT VALID JSON ONLY WITH THIS EXACT SCHEMA:
{
  "jobTitle": "Extracted exact job title from circular",
  "companyName": "Extracted company name or Target Company",
  "experienceLevel": "Target experience level",
  "overviewAdvice": "Comprehensive tactical advice comparing Candidate CV with Job Circular requirements to crack the technical rounds.",
  "skillsPrepared": [
    {
      "skillName": "Clean Single Skill Name (e.g. Next.js)",
      "questions": [
        {
          "id": 1,
          "category": "Specific Sub-Domain (e.g. Edge Middleware & Token Rotation)",
          "question": "Deep scenario-based technical question...",
          "answer": "Detailed model answer explaining exact mechanics and trade-offs...",
          "keyPoints": [
            "Verbal takeaway point 1",
            "Verbal takeaway point 2",
            "Verbal takeaway point 3"
          ]
        }
      ]
    }
  ]
}`;

    const promptText = `JOB CIRCULAR DETAILS:
Job Title: ${job.jobTitle || 'N/A'}
Company: ${job.companyName || 'N/A'}
Experience Level: ${job.experienceLevel || 'Mid to Senior'}
Required Skills: ${Array.isArray(job.requiredSkills) ? job.requiredSkills.join(', ') : job.requiredSkills || 'N/A'}
Preferred Skills: ${Array.isArray(job.preferredSkills) ? job.preferredSkills.join(', ') : job.preferredSkills || 'N/A'}
Responsibilities: ${Array.isArray(job.responsibilities) ? job.responsibilities.join('\n') : job.responsibilities || 'N/A'}
Qualifications: ${Array.isArray(job.qualifications) ? job.qualifications.join('\n') : job.qualifications || 'N/A'}
Full Job Circular Text:
${job.rawTextCaptured || job.detailedOverview || JSON.stringify(job)}

CANDIDATE CV DETAILS (SOURCE OF TRUTH):
Candidate Name: ${candidateCv?.candidateName || 'Candidate'}
Candidate Skills: ${Array.isArray(candidateCv?.extractedSkills) ? candidateCv.extractedSkills.join(', ') : candidateCv?.extractedSkills || 'N/A'}
Candidate Experience / Full CV Text:
${candidateCv?.rawCvText ? candidateCv.rawCvText.substring(0, 4000) : 'No candidate CV text provided.'}`;

    // 1. Try Primary Provider: n8n Webhook (GPT-4o-Mini)
    try {
      const n8nResult = await callN8nWebhook({
        action: 'generate-interview-prep',
        prompt: `${systemInstruction}\n\n${promptText}`,
        systemInstruction,
        promptText,
        job,
        candidateCv
      });

      n8nResult.success = true;
      n8nResult.provider = 'n8n GPT-4o-Mini';
      return res.json(n8nResult);
    } catch (n8nError) {
      console.warn('[JobExtensionController] n8n Webhook call failed, trying Gemini fallback:', n8nError.message);
    }

    // 2. Fallback Provider: Gemini SDK
    const effectiveApiKey = apiKey || process.env.GEMINI_API_KEY;
    const { text, modelUsed } = await callGeminiSDK(promptText, systemInstruction, effectiveApiKey);
    const parsed = parseCleanJson(text);
    parsed.success = true;
    parsed.provider = `Gemini (${modelUsed})`;

    return res.json(parsed);

  } catch (error) {
    console.error('[JobExtensionController] generateInterviewPrep error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate interview questions.'
    });
  }
};

/**
 * Controller: Parse Job Posting & CV Match Analysis
 * Endpoint: POST /api/job-extension/parse-job
 */
exports.parseJob = async (req, res) => {
  try {
    const { rawText, sourceUrl = '', candidateCv = null, apiKey } = req.body;

    if (!rawText || rawText.trim().length === 0) {
      return res.status(400).json({ error: 'No rawText provided to parse.' });
    }

    const maxChars = 15000;
    const cleanedText = rawText.length > maxChars ? rawText.substring(0, maxChars) + '...' : rawText;

    const cvContext = candidateCv && candidateCv.rawCvText
      ? `\n\nCANDIDATE CV DATA:\nCandidate Name: ${candidateCv.candidateName}\nSkills: ${candidateCv.extractedSkills?.join(', ')}\nCV Text:\n${candidateCv.rawCvText.substring(0, 4000)}`
      : '\n\nCANDIDATE CV DATA: No CV provided.';

    const systemInstruction = `You are a master technical recruiter and job parser AI. Analyze the provided job posting text and extract structured information strictly in JSON format.

JSON Schema required:
{
  "jobTitle": "String",
  "companyName": "String",
  "location": "String",
  "jobType": "String",
  "salaryRange": "String",
  "experienceLevel": "String",
  "requiredSkills": ["Array of skills"],
  "preferredSkills": ["Array of skills"],
  "responsibilities": ["Array of points"],
  "qualifications": ["Array of points"],
  "benefits": ["Array of benefits"],
  "contactEmail": "String",
  "recommendedEmailSubject": "String",
  "applyUrl": "String",
  "detailedOverview": "String",
  "matchScore": Number (0-100),
  "matchStatus": "String",
  "matchingSkills": ["Array"],
  "missingSkills": ["Array"],
  "matchRecommendation": "String"
}`;

    const promptText = `Source Page URL: ${sourceUrl}\n\nJOB POST CONTENT:\n${cleanedText}${cvContext}`;

    // 1. Try Primary Provider: n8n Webhook (GPT-4o-Mini)
    try {
      const n8nResult = await callN8nWebhook({
        action: 'parse-job',
        prompt: `${systemInstruction}\n\n${promptText}`,
        systemInstruction,
        promptText,
        rawText: cleanedText,
        sourceUrl,
        candidateCv
      });

      return res.json({
        success: true,
        provider: 'n8n GPT-4o-Mini',
        jobTitle: n8nResult.jobTitle || 'Job Opportunity',
        companyName: n8nResult.companyName || 'Not specified',
        location: n8nResult.location || 'Remote/Unspecified',
        jobType: n8nResult.jobType || 'Full-time',
        salaryRange: n8nResult.salaryRange || 'Not specified',
        experienceLevel: n8nResult.experienceLevel || 'Not specified',
        requiredSkills: Array.isArray(n8nResult.requiredSkills) ? n8nResult.requiredSkills : [],
        preferredSkills: Array.isArray(n8nResult.preferredSkills) ? n8nResult.preferredSkills : [],
        responsibilities: Array.isArray(n8nResult.responsibilities) ? n8nResult.responsibilities : [],
        qualifications: Array.isArray(n8nResult.qualifications) ? n8nResult.qualifications : [],
        benefits: Array.isArray(n8nResult.benefits) ? n8nResult.benefits : [],
        contactEmail: n8nResult.contactEmail || '',
        recommendedEmailSubject: n8nResult.recommendedEmailSubject || `Application for ${n8nResult.jobTitle || 'Role'}`,
        applyUrl: n8nResult.applyUrl || sourceUrl,
        detailedOverview: n8nResult.detailedOverview || cleanedText.substring(0, 500) + '...',
        matchScore: typeof n8nResult.matchScore === 'number' ? n8nResult.matchScore : 0,
        matchStatus: n8nResult.matchStatus || 'Evaluated',
        matchingSkills: Array.isArray(n8nResult.matchingSkills) ? n8nResult.matchingSkills : [],
        missingSkills: Array.isArray(n8nResult.missingSkills) ? n8nResult.missingSkills : [],
        matchRecommendation: n8nResult.matchRecommendation || 'Match analysis complete.',
        rawTextCaptured: cleanedText.substring(0, 3500),
        sourceUrl: sourceUrl
      });
    } catch (n8nError) {
      console.warn('[JobExtensionController] n8n Webhook call failed, trying Gemini fallback:', n8nError.message);
    }

    // 2. Fallback Provider: Gemini SDK
    const effectiveApiKey = apiKey || process.env.GEMINI_API_KEY;
    const { text, modelUsed } = await callGeminiSDK(promptText, systemInstruction, effectiveApiKey);
    const parsedJson = parseCleanJson(text);

    return res.json({
      success: true,
      provider: `Gemini (${modelUsed})`,
      jobTitle: parsedJson.jobTitle || 'Job Opportunity',
      companyName: parsedJson.companyName || 'Not specified',
      location: parsedJson.location || 'Remote/Unspecified',
      jobType: parsedJson.jobType || 'Full-time',
      salaryRange: parsedJson.salaryRange || 'Not specified',
      experienceLevel: parsedJson.experienceLevel || 'Not specified',
      requiredSkills: Array.isArray(parsedJson.requiredSkills) ? parsedJson.requiredSkills : [],
      preferredSkills: Array.isArray(parsedJson.preferredSkills) ? parsedJson.preferredSkills : [],
      responsibilities: Array.isArray(parsedJson.responsibilities) ? parsedJson.responsibilities : [],
      qualifications: Array.isArray(parsedJson.qualifications) ? parsedJson.qualifications : [],
      benefits: Array.isArray(parsedJson.benefits) ? parsedJson.benefits : [],
      contactEmail: parsedJson.contactEmail || '',
      recommendedEmailSubject: parsedJson.recommendedEmailSubject || `Application for ${parsedJson.jobTitle || 'Role'}`,
      applyUrl: parsedJson.applyUrl || sourceUrl,
      detailedOverview: parsedJson.detailedOverview || cleanedText.substring(0, 500) + '...',
      matchScore: typeof parsedJson.matchScore === 'number' ? parsedJson.matchScore : 0,
      matchStatus: parsedJson.matchStatus || 'Evaluated',
      matchingSkills: Array.isArray(parsedJson.matchingSkills) ? parsedJson.matchingSkills : [],
      missingSkills: Array.isArray(parsedJson.missingSkills) ? parsedJson.missingSkills : [],
      matchRecommendation: parsedJson.matchRecommendation || 'Match analysis complete.',
      rawTextCaptured: cleanedText.substring(0, 3500),
      sourceUrl: sourceUrl
    });

  } catch (error) {
    console.error('[JobExtensionController] parseJob error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to parse job post.'
    });
  }
};
