# OpenAI Hackathon Product Plan: Proven Talent Highlight Reel

## 1. Product Concept

**Proven Talent Highlight Reel** is an AI-guided interview experience that helps candidates go beyond their resume. The product conducts a short, conversational video interview, asks contextual follow-up questions based on the candidate's resume, profile, and goals, then automatically creates a 2-3 minute highlight reel for employers.

The goal is to help overlooked candidates be seen more fully: not only for where they worked or studied, but for how they think, communicate, solve problems, reflect on failure, and fit a team.

## 2. Problem

Resumes are shallow, biased, and hard to differentiate, especially for early-career candidates or candidates from non-traditional backgrounds. Employers want signals beyond keywords, but structured interviewing does not scale well across large applicant pools.

Candidates also struggle to show who they are. A resume rarely captures their judgment, resilience, ambition, communication style, or the story behind their work.

## 3. Target Users

**Primary user: job candidates**

- Early-career candidates
- Career switchers
- Candidates with non-linear backgrounds
- Candidates who are stronger in conversation than on paper

**Secondary user: employers**

- Recruiters screening large applicant pools
- Hiring managers who want richer candidate context
- Employers looking to reduce false negatives in resume screening

## 4. MVP Experience

The hackathon MVP should feel like a simple FaceTime-style conversation with an AI interviewer.

### Candidate Flow

1. Candidate uploads or connects a resume / Proven profile.
2. Candidate enters target role, career goals, and optionally a company-specific challenge.
3. AI interviewer starts with: "Tell me about yourself."
4. AI asks two contextual follow-up questions based on the answer.
5. AI deep-dives into one meaningful resume or profile item.
6. AI asks one case-study-style question tailored to the candidate's resume and career goals.
7. AI asks one culture / reflection question, such as:
   - "Tell me about a time you struggled to complete something."
   - "Tell me about a time you had conflict with a teammate."
   - "Tell me about a time you failed and what you learned."
8. Candidate taps a done/pause button when finished with each answer.
9. System generates a short candidate profile and 2-3 minute highlight reel.

### Employer Flow

1. Employer views the candidate's short AI-generated profile.
2. Employer watches the 2-3 minute highlight reel.
3. Employer sees tagged moments by theme:
   - Motivation
   - Communication
   - Problem solving
   - Resilience
   - Role fit
   - Culture fit
4. Employer can optionally request a company-specific interview prompt set.

## 5. Core AI Capabilities

### Conversational Interviewer

The AI should guide the interview naturally while keeping the structure tight. It should not sound like a form or chatbot. It should ask concise, relevant follow-ups and adapt to the candidate's prior answers.

### Resume and Goal-Aware Questioning

The AI should use the candidate's resume, profile, and career goals to generate questions with the right level of difficulty. For example, early-career candidates should not be judged by senior-level expectations.

### Highlight Reel Generation

The system should transform a longer interview, approximately 15-20 minutes, into a 2-3 minute highlight reel showing the candidate's strongest moments.

The reel should include light interstitials or title cards that make the narrative easier to follow:

- "Why this candidate"
- "Relevant experience"
- "How they solve problems"
- "How they handle setbacks"
- "What they want next"

### Candidate Summary

The system should produce a short employer-facing summary:

- One-line positioning statement
- Top strengths
- Relevant experience
- Notable quote or moment
- Suggested role fit
- Watch highlights

## 6. MVP Scope

### Must Have

- Resume/profile intake
- Role and career goal intake
- AI-generated interview script
- Voice or video-style interview UI
- Candidate answer recording
- Follow-up question generation
- Transcript generation
- Highlight selection
- 2-3 minute highlight reel outline or generated video
- Employer-facing candidate summary

### Should Have

- Done/pause button for answer completion
- Moment tagging by competency
- Interstitial title cards
- Open challenge vs. company-specific challenge mode
- Basic scoring rubric for employer review

### Could Have

- Employer prompt customization
- Side-by-side resume plus video profile
- Candidate retake controls
- Recruiter search/filter by AI-derived strengths
- Shareable candidate profile link

### Not in MVP

- Full ATS integration
- Fully automated hiring decisions
- Complex multi-round interview workflows
- Deep analytics dashboards

## 7. Differentiation

Most hiring tools optimize resume screening. This product creates a new artifact: a structured, human-centered candidate highlight reel.

The differentiation is not just "AI interview questions." It is the combination of:

- Personalized interview generation
- Structured candidate storytelling
- Employer-ready highlight extraction
- Scaled access for people whose resumes underrepresent them

## 8. Hackathon Demo

### Demo Setup

Use a sample candidate resume and target role.

Example:

- Candidate: early-career product analyst
- Goal: transition into product management
- Company challenge: improve onboarding for a fintech app

### Demo Script

1. Show candidate uploading resume/profile.
2. Show AI generating a personalized interview plan.
3. Run a short simulated interview:
   - Tell me about yourself
   - Contextual follow-up
   - Resume deep dive
   - Case study
   - Culture/reflection question
4. Show transcript with tagged strong moments.
5. Show generated candidate summary.
6. Show 2-3 minute highlight reel storyboard or playable cut.
7. Show employer view with candidate strengths and recommended fit.

### Winning Moment

The strongest demo moment is the before/after:

- Before: a flat resume that undersells the candidate.
- After: a concise, compelling video profile that shows how the candidate thinks and communicates.

## 9. Product Architecture

### Inputs

- Resume or Proven profile
- Candidate career goals
- Target role
- Optional employer-specific challenge
- Video/audio interview responses

### Processing

- Parse resume/profile
- Generate interview plan
- Conduct conversational interview
- Transcribe answers
- Identify strongest clips
- Tag clips by competency
- Generate employer summary
- Assemble highlight reel with interstitials

### Outputs

- Candidate transcript
- Candidate profile summary
- Highlight reel
- Tagged interview moments
- Employer-facing review page

## 10. Suggested OpenAI Usage

- Use a realtime conversational model for the interview experience.
- Use a reasoning-capable model to generate tailored interview questions from resume and role context.
- Use transcription for candidate responses.
- Use multimodal/video or transcript-based analysis to identify strong moments.
- Use text generation to produce the employer-facing summary and interstitial copy.

## 11. Success Metrics

### Candidate Metrics

- Completion rate
- Candidate satisfaction
- Percentage of candidates who feel better represented than by resume alone
- Average time to create profile

### Employer Metrics

- Recruiter watch rate
- Shortlist rate
- Interview invite rate
- Reduction in time spent screening
- Recruiter-rated usefulness of highlight reel

### Marketplace Metrics

- Increase in candidate-employer matches
- Reduction in resume-only false negatives
- Employer conversion to company-specific challenge plans

## 12. Business Model

### Open Challenge

Candidates complete a general Proven interview flow that can be shared with multiple employers.

### Company-Specific Challenge

Employers pay for customized interview flows aligned to their role, culture, and evaluation criteria.

Potential pricing mentioned in the transcript: around **$500/month** for employer-owned or customized flows.

## 13. Risks and Mitigations

### Bias in AI Evaluation

Mitigation: avoid automated pass/fail decisions. Position AI as a summarization and discovery layer, not a hiring authority.

### Candidate Anxiety

Mitigation: provide clear controls, retakes, pause/done actions, and a friendly conversational tone.

### Over-polished or Misleading Summaries

Mitigation: ground every summary claim in transcript evidence and link each strength to a source clip.

### Privacy and Consent

Mitigation: require explicit candidate consent before sharing videos with employers.

### Employer Trust

Mitigation: show transcript-backed evidence, not black-box scores.

## 14. Hackathon Build Plan

### Day 1: Core Flow

- Build resume/profile intake
- Generate structured interview plan
- Build candidate interview UI
- Capture or simulate candidate responses

### Day 2: AI Processing

- Add transcription
- Add contextual follow-up generation
- Add highlight moment detection
- Generate candidate summary

### Day 3: Demo Polish

- Build employer review page
- Add highlight reel storyboard or playable cut
- Add competency tags
- Prepare demo candidate and employer scenario
- Tighten narrative around impact and readiness

## 15. Judging Criteria Framing

### Impact

This product expands access to opportunity by helping candidates be evaluated on richer signals than resumes alone. It helps unlock talent that employers might otherwise miss.

### Quality

The experience is structured, focused, and realistic. It creates a useful employer artifact rather than a novelty chatbot.

### Readiness

The MVP can be built with existing AI capabilities: resume parsing, conversational interviewing, transcription, summarization, clip selection, and employer-facing review pages.

## 16. Positioning Statement

**Proven Talent Highlight Reel helps candidates go beyond the resume by turning an AI-guided interview into a concise, employer-ready video profile that shows how they think, communicate, and grow.**
