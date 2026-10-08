import OpenAI from "openai";
import { PDFParse } from "pdf-parse";
import Analysis from "../models/Analysis.js";

const generateLocalAnalysis = (resumeText, jobDescription) => {
  const commonKeywords = [
    "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Express",
    "Python", "Django", "Flask", "Java", "Spring Boot", "C++", "C#", ".NET",
    "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "GraphQL", "REST APIs",
    "HTML", "CSS", "Tailwind CSS", "Bootstrap", "Git", "GitHub", "Docker",
    "Kubernetes", "AWS", "Azure", "GCP", "CI/CD", "Linux", "Unit Testing",
    "Agile", "Scrum", "Microservices", "System Design"
  ];

  const resumeLower = (resumeText || "").toLowerCase();
  const jobLower = (jobDescription || "").toLowerCase();
  const hasJobDesc = Boolean(jobDescription && jobDescription.trim());

  let matchedKeywords = [];
  let missingKeywords = [];

  if (hasJobDesc) {
    const jobKeywords = commonKeywords.filter((kw) =>
      jobLower.includes(kw.toLowerCase())
    );

    const targetList = jobKeywords.length > 0 ? jobKeywords : commonKeywords.slice(0, 8);

    matchedKeywords = targetList.filter((kw) =>
      resumeLower.includes(kw.toLowerCase())
    );
    missingKeywords = targetList.filter(
      (kw) => !resumeLower.includes(kw.toLowerCase())
    );
  }

  const words = (resumeText || "").trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const hasMetrics = /\b\d+%|\$\d+|\b\d+\s*(users|clients|projects|million|k)\b/i.test(resumeText);
  const hasEducation = /bachelor|master|degree|university|college|gpa/i.test(resumeText);
  const hasExperience = /experience|worked|developed|implemented|led|managed|engineered/i.test(resumeText);

  let overallScore = 6;
  if (wordCount >= 150) overallScore += 1;
  if (hasMetrics) overallScore += 1;
  if (hasEducation && hasExperience) overallScore += 1;
  overallScore = Math.min(10, Math.max(1, overallScore));

  let atsMatchScore = null;
  if (hasJobDesc) {
    const totalKeywords = matchedKeywords.length + missingKeywords.length;
    const ratio = totalKeywords > 0 ? matchedKeywords.length / totalKeywords : 0.5;
    atsMatchScore = Math.min(10, Math.max(2, Math.round(ratio * 10)));
  }

  const strengths = [];
  if (hasExperience) strengths.push("Strong action-oriented language highlighting technical implementation.");
  if (hasMetrics) strengths.push("Includes quantifiable impact and measurable outcomes in bullet points.");
  if (wordCount >= 120) strengths.push("Comprehensive coverage of technical stack and practical experience.");
  if (strengths.length === 0) strengths.push("Clear baseline presentation of technical background.");

  const weaknesses = [];
  if (!hasMetrics) weaknesses.push("Lacks measurable metrics (% improved, scale, latency reduction) to highlight business impact.");
  if (missingKeywords.length > 0) weaknesses.push(`Key job requirements not clearly detected: ${missingKeywords.slice(0, 3).join(", ")}.`);
  if (wordCount < 120) weaknesses.push("Resume content is concise; consider adding detail to recent projects and contributions.");
  if (weaknesses.length === 0) weaknesses.push("Bullet points could further emphasize technical leadership and end-to-end ownership.");

  const atsSuggestions = hasJobDesc ? [
    missingKeywords.length > 0
      ? `Incorporate missing keywords naturally into experience bullets: ${missingKeywords.slice(0, 4).join(", ")}.`
      : "Maintain keyword density and ensure standard ATS section headers (Work Experience, Skills, Education).",
    "Use standard chronological layout with clean bullet points and avoid multi-column tables or icons for higher ATS parser readability.",
  ] : [];

  const suggestions = [
    "Use the STAR method (Situation, Task, Action, Result) for bullet points to show measurable results.",
    "Add a dedicated 'Technical Skills' section categorizing languages, frameworks, databases, and developer tools.",
    "Ensure contact details, GitHub, and LinkedIn profiles are prominent and active at the top.",
  ];

  return {
    overallScore,
    atsMatchScore,
    summary: `Resume demonstrates solid technical foundation${hasJobDesc ? ` with an ATS alignment score of ${atsMatchScore}/10 for the target role` : ""}. Enhancing quantifiable metrics and aligning section keywords will significantly strengthen ATS pass rates.`,
    strengths,
    weaknesses,
    matchedKeywords,
    missingKeywords,
    atsSuggestions,
    suggestions,
  };
};

const analyzeResume = async (req, res) => {
  try {
    const { resumeText, jobDescription, resumeLabel, jobLabel } = req.body || {};
    let finalResumeText = resumeText?.trim() || "";
    const trimmedResumeLabel = resumeLabel?.trim() || "";
    const trimmedJobLabel = jobLabel?.trim() || "";
    const originalFileName = req.file?.originalname || "";

    const generatedResumeLabel =
      trimmedResumeLabel ||
      originalFileName ||
      finalResumeText?.split("\n").map((line) => line.trim()).find(Boolean) ||
      "Untitled Resume";

    const generatedJobLabel =
      trimmedJobLabel ||
      jobDescription
        ?.split("\n")
        .map((line) => line.trim())
        .find(Boolean) ||
      "No Job Label";
    const hasJobDescription = jobDescription && jobDescription.trim() !== "";

    if (req.file) {
      try {
        const parser = new PDFParse({
          data: req.file.buffer,
        });

        const parsedPdf = await parser.getText();
        finalResumeText = parsedPdf.text.trim();
      } catch (error) {
        console.error("PDF parse error:", error);

        return res.status(400).json({
          message: "Failed to parse uploaded PDF.",
        });
      }
    }

    if (!finalResumeText) {
      return res.status(400).json({
        message: "Resume text or PDF file is required.",
      });
    }

    let parsed;

    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== "") {
      try {
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY.trim(),
        });

        const prompt = `
You are a senior ATS (Applicant Tracking System) optimization expert and professional resume reviewer.

Your job is to analyze a resume and compare it against a job description (if provided), producing structured, high-quality, realistic ATS feedback.

Return ONLY valid JSON in this EXACT format:

{
  "overallScore": number,
  "atsMatchScore": number | null,
  "summary": "2-3 sentence professional evaluation",
  "strengths": ["point 1", "point 2", "point 3"],
  "weaknesses": ["point 1", "point 2", "point 3"],
  "matchedKeywords": ["keyword 1", "keyword 2", "keyword 3"],
  "missingKeywords": ["keyword 1", "keyword 2", "keyword 3"],
  "atsSuggestions": ["ATS-specific improvement 1", "ATS-specific improvement 2"],
  "suggestions": ["general improvement 1", "general improvement 2"]
}

CRITICAL RULES:

1. overallScore:
- Score from 1–10
- Based on structure, clarity, impact, projects, and professionalism

2. atsMatchScore:
- Score from 1–10
- Based ONLY on how well the resume matches the job description
- If NO job description → return null

3. matchedKeywords:
- Extract important technical keywords FROM THE JOB DESCRIPTION
- Include ONLY keywords that clearly appear in the resume
- Examples: "React", "Node.js", "MongoDB", "REST APIs"

4. missingKeywords:
- Extract important keywords from job description NOT found in resume
- Do NOT hallucinate keywords
- Only include realistic, meaningful terms

5. atsSuggestions:
- Must be SPECIFIC to ATS optimization
- Focus on:
  - missing keywords
  - formatting issues
  - keyword density
  - alignment with job description

6. suggestions:
- General resume improvements
- Focus on:
  - impact (metrics, numbers)
  - clarity
  - stronger bullet points
  - better structure

7. STRICT BEHAVIOR:
- If no job description:
  - atsMatchScore = null
  - matchedKeywords = []
  - missingKeywords = []
  - atsSuggestions = []
- DO NOT mix ATS suggestions into general suggestions
- DO NOT return explanations outside JSON

Resume:
${finalResumeText}

Job Description:
${hasJobDescription ? jobDescription.trim() : "Not provided"}
`;

        const response = await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a professional resume analyzer.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
        });

        const aiText = response.choices[0].message.content;
        const cleaned = aiText
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();

        parsed = JSON.parse(cleaned);
      } catch (aiErr) {
        console.warn("OpenAI API call failed or timed out, using fallback analyzer:", aiErr.message);
        parsed = generateLocalAnalysis(finalResumeText, jobDescription);
      }
    } else {
      console.log("No OPENAI_API_KEY detected; using built-in intelligent ATS analyzer.");
      parsed = generateLocalAnalysis(finalResumeText, jobDescription);
    }

    parsed.matchedKeywords = parsed.matchedKeywords || [];
    parsed.missingKeywords = parsed.missingKeywords || [];
    parsed.atsSuggestions = parsed.atsSuggestions || [];
    parsed.suggestions = parsed.suggestions || [];

    const normalizeScore = (value, allowNull = false) => {
      if (allowNull && (value === null || value === undefined || value === "")) {
        return null;
      }

      const num = Number(value);

      if (Number.isNaN(num)) {
        return allowNull ? null : 0;
      }

      if (num > 10 && num <= 100) {
        return Math.round(num / 10);
      }

      return Math.max(0, Math.min(10, Math.round(num)));
    };

    parsed.overallScore = normalizeScore(parsed.overallScore);
    parsed.atsMatchScore = normalizeScore(parsed.atsMatchScore, true);

    return res.status(200).json({
      message: "Resume analyzed successfully.",
      analysis: parsed,
      resumeText: finalResumeText,
      jobDescription: jobDescription?.trim() || "",
      resumeLabel: generatedResumeLabel,
      jobLabel: generatedJobLabel,
      originalFileName,
    });
  } catch (error) {
    console.error("Analysis Error:", error);

    return res.status(500).json({
      message: "Error analyzing resume.",
    });
  }
};
const getUserAnalyses = async (req, res) => {
  try {
    const analyses = await Analysis.find({ user: req.user.userId }).sort({
      createdAt: -1,
    });

    return res.status(200).json(analyses);
  } catch (error) {
    console.error("Fetch Analyses Error:", error);

    return res.status(500).json({
      message: "Failed to fetch analysis history.",
    });
  }
};

const deleteAnalysis = async (req, res) => {
  try {
    const analysis = await Analysis.findById(req.params.id);

    if (!analysis) {
      return res.status(404).json({
        message: "Analysis not found.",
      });
    }

    if (analysis.user.toString() !== req.user.userId) {
      return res.status(403).json({
        message: "Not authorized to delete this analysis.",
      });
    }

    await analysis.deleteOne();

    return res.status(200).json({
      message: "Analysis deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Analysis Error:", error);

    return res.status(500).json({
      message: "Failed to delete analysis.",
    });
  }
};
const saveAnalysis = async (req, res) => {
  try {
    const {
      resumeText,
      jobDescription,
      analysisResult,
      resumeLabel,
      jobLabel,
      originalFileName,
    } = req.body || {};

    if (!resumeText || !analysisResult) {
      return res.status(400).json({
        message: "Missing required data to save analysis.",
      });
    }

    const savedAnalysis = await Analysis.create({
      user: req.user.userId,
      resumeText,
      jobDescription: jobDescription || "",
      analysisResult,
      resumeLabel: resumeLabel || "Untitled Resume",
      jobLabel: jobLabel || "No Job Label",
      originalFileName: originalFileName || "",
    });

    return res.status(201).json({
      message: "Analysis saved successfully.",
      savedAnalysisId: savedAnalysis._id,
    });
  } catch (error) {
    console.error("Save Analysis Error:", error);

    return res.status(500).json({
      message: "Failed to save analysis.",
    });
  }
};
export { analyzeResume, getUserAnalyses, deleteAnalysis, saveAnalysis };