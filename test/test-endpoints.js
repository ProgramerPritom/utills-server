/**
 * Endpoints Test Suite
 * Tests all Express server endpoints for Job Extension (Email Gen, Interview Prep, Job Parse, and Error Handling)
 * Run with: npm test
 */

require('dotenv').config();
const BASE_URL = process.env.SERVER_URL || 'http://localhost:5000';

const sampleJobPayload = {
  jobTitle: 'Senior Full Stack Developer',
  companyName: 'InnovateTech Solutions',
  experienceLevel: '3+ years',
  requiredSkills: ['JavaScript', 'React', 'Node.js', 'Express', 'MongoDB'],
  responsibilities: [
    'Design and build high-scale RESTful APIs using Node.js and Express',
    'Develop responsive user interfaces with React and Redux',
    'Optimize database query performance in MongoDB'
  ],
  qualifications: [
    '3+ years of professional software engineering experience',
    'Strong knowledge of asynchronous JavaScript and clean code principles'
  ],
  detailedOverview: 'InnovateTech Solutions is seeking an experienced Senior Full Stack Developer to build modern cloud applications. The ideal candidate has deep expertise in React and Node.js.'
};

const sampleCvPayload = {
  candidateName: 'Pritom Dev',
  contactEmail: 'pritom@example.com',
  githubUrl: 'github.com/pritom-dev',
  portfolioUrl: 'pritom-portfolio.com',
  linkedinUrl: 'linkedin.com/in/pritom-dev',
  extractedSkills: ['JavaScript', 'React', 'Node.js', 'Express', 'MongoDB', 'TypeScript'],
  rawCvText: `Pritom Dev - Full Stack Software Engineer
Email: pritom@example.com | GitHub: github.com/pritom-dev
Summary: Experienced Full Stack Developer specializing in React.js, Node.js, and Express.js backends. Built high-throughput API services, real-time dashboards, and chrome extensions.
Skills: JavaScript, TypeScript, React, Node.js, Express, MongoDB, REST APIs, Git.
Experience: Built multiple web automation projects and scalable backend APIs.`
};

async function runTests() {
  console.log(`\n🧪 ========================================================`);
  console.log(`🧪 Starting Endpoint Tests on: ${BASE_URL}`);
  console.log(`🧪 ========================================================\n`);

  // Test 1: Health Check Endpoint
  await testEndpoint('GET / (Server Health Check)', `${BASE_URL}/`, {
    method: 'GET'
  });

  console.log('⏳ Waiting 12 seconds for Gemini Free Tier rate-limit window...');
  await new Promise(r => setTimeout(r, 12000));

  // Test 2: Email Generation Endpoint
  await testEndpoint('POST /api/job-extension/generate-email', `${BASE_URL}/api/job-extension/generate-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      job: sampleJobPayload,
      candidateCv: sampleCvPayload
    })
  });

  console.log('⏳ Waiting 12 seconds for Gemini Free Tier rate-limit window...');
  await new Promise(r => setTimeout(r, 12000));

  // Test 3: Technical Interview Prep Endpoint
  await testEndpoint('POST /api/job-extension/generate-interview-prep', `${BASE_URL}/api/job-extension/generate-interview-prep`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      job: sampleJobPayload,
      candidateCv: sampleCvPayload
    })
  });

  console.log('⏳ Waiting 12 seconds for Gemini Free Tier rate-limit window...');
  await new Promise(r => setTimeout(r, 12000));

  // Test 4: Job Circular Parsing Endpoint
  await testEndpoint('POST /api/job-extension/parse-job', `${BASE_URL}/api/job-extension/parse-job`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rawText: `Senior Full Stack Engineer needed at InnovateTech Solutions. Remote role. Salary $80k-$100k. Required skills: React, Node.js, MongoDB, Express. Contact hr@innovatetech.com to apply.`,
      sourceUrl: 'https://example.com/job/123',
      candidateCv: sampleCvPayload
    })
  });

  // Test 5: Error Test - Missing Job Data
  await testEndpoint('POST /api/job-extension/generate-email (Error Validation Test - Missing Job)', `${BASE_URL}/api/job-extension/generate-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      candidateCv: sampleCvPayload
    })
  });

  console.log(`\n✅ All endpoint test calls executed. Review status codes above.`);
}

async function testEndpoint(name, url, options) {
  console.log(`--------------------------------------------------------`);
  console.log(`▶ Running: ${name}`);
  try {
    const start = Date.now();
    const res = await fetch(url, options);
    const duration = Date.now() - start;
    const data = await res.json().catch(() => ({ rawText: 'Non-JSON response' }));

    if (res.ok) {
      console.log(`✅ [HTTP ${res.status}] Passed (${duration}ms)`);
      console.log(`   Response summary:`, JSON.stringify(data, null, 2).substring(0, 350) + '...');
    } else {
      console.log(`⚠️ [HTTP ${res.status}] Server returned error response (${duration}ms)`);
      console.log(`   Error details:`, JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error(`❌ Request Failed: ${err.message}`);
  }
}

runTests();
