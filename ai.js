const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
}

// Clients
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper to get mime type
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

// Helper to clean Gemini JSON output
function cleanGeminiJSON(text) {
  try {
    // Cari JSON di dalam string (menghapus markdown ```json ... ```)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("Clean JSON Error:", e.message, "Raw Text:", text);
    throw e;
  }
}

// ========================
// ANALYZE FOOD TEXT (Groq)
// ========================
async function analyzeFoodText(description) {
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `Kamu adalah ahli nutrisi cyberpunk. Analisis makanan dan berikan JSON.
Format JSON:
{
  "food_items": [ { "name": "nama", "amount": "porsi", "grams": 100 } ],
  "nutrition": { "calories": 0, "protein": 0, "fat": 0, "cholesterol": 0, "sodium": 0, "carbs": 0, "fiber": 0, "sugar": 0 },
  "summary": "ringkasan bahasa Indonesia"
}`
        },
        { role: "user", content: description }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      response_format: { type: "json_object" }
    });
    return JSON.parse(completion.choices[0]?.message?.content);
  } catch (error) {
    console.error('Groq Text Error:', error.message);
    return { summary: "Error analisis teks: " + error.message, nutrition: { calories: 0 } };
  }
}

// ========================
// ANALYZE FOOD IMAGE (Gemini)
// ========================
async function analyzeFoodImage(imagePath) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const imageBuffer = fs.readFileSync(imagePath);
    const mimeType = getMimeType(imagePath);
    
    const prompt = `TUGAS: Analisis foto makanan ini secara akurat.
    1. Identifikasi semua item makanan dan estimasi berat/porsi.
    2. Hitung total Kalori, Protein, Lemak, Kolesterol, Sodium, Karbo, Serat, Gula.
    3. Berikan ringkasan singkat dalam Bahasa Indonesia.
    
    KEMBALIKAN HANYA DATA JSON TANPA TEKS LAIN:
    {
      "food_items": [ { "name": "nama", "amount": "porsi", "grams": 0 } ],
      "nutrition": { "calories": 0, "protein": 0, "fat": 0, "cholesterol": 0, "sodium": 0, "carbs": 0, "fiber": 0, "sugar": 0 },
      "summary": "..."
    }`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBuffer.toString("base64"),
          mimeType: mimeType
        }
      }
    ]);

    const text = result.response.text();
    return cleanGeminiJSON(text);
  } catch (error) {
    console.error('Gemini Food Error:', error.message);
    return { 
      food_items: [], 
      nutrition: { calories: 0, protein: 0, fat: 0, cholesterol: 0, sodium: 0, carbs: 0, fiber: 0, sugar: 0 }, 
      summary: "Gagal analisis gambar. Error: " + error.message 
    };
  }
}

// ========================
// ANALYZE BODY SCAN (Gemini)
// ========================
async function analyzeBodyImage(imagePath) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const imageBuffer = fs.readFileSync(imagePath);
    const mimeType = getMimeType(imagePath);
    
    const prompt = `TUGAS: Analisis foto tubuh ini sebagai pakar fitness profesional.
    1. Estimasi Body Fat Percentage.
    2. Assessment massa otot.
    3. Analisis postur.
    4. Berikan rekomendasi Diet, Goal, dan Latihan (Weekly Plan).
    
    KEMBALIKAN HANYA DATA JSON TANPA TEKS LAIN:
    {
      "body_assessment": { "body_fat_estimate": "...", "muscle_assessment": "...", "posture": "...", "overall_condition": "..." },
      "recommendations": { "goal": "...", "diet_strategy": "...", "workout_focus": [], "exercises": [{ "name": "...", "sets": "...", "reps": "...", "notes": "..." }], "weekly_plan": "...", "tips": [] },
      "summary": "..."
    }`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBuffer.toString("base64"),
          mimeType: mimeType
        }
      }
    ]);

    const text = result.response.text();
    return cleanGeminiJSON(text);
  } catch (error) {
    console.error('Gemini Body Error:', error.message);
    return { 
      body_assessment: { body_fat_estimate: "N/A", muscle_assessment: "N/A", posture: "N/A", overall_condition: "N/A" },
      recommendations: { goal: "N/A", diet_strategy: "N/A", workout_focus: [], exercises: [], weekly_plan: "N/A", tips: [] },
      summary: "Gagal analisis tubuh. Error: " + error.message 
    };
  }
}

// ========================
// ESTIMATIONS & RECAP
// ========================
async function estimateCaloriesBurned(workoutData) {
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "Hitung estimasi kalori terbakar dalam JSON: { \"calories_burned\": 0, \"intensity\": \"low/medium/high\", \"notes\": \"...\" }" },
        { role: "user", content: JSON.stringify(workoutData) }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      response_format: { type: "json_object" }
    });
    return JSON.parse(completion.choices[0]?.message?.content);
  } catch (error) { return { calories_burned: 200, notes: "Fallback" }; }
}

async function analyzeBodyProfile(profileData) {
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "Hitung kebutuhan nutrisi harian dalam JSON valid." },
        { role: "user", content: JSON.stringify(profileData) }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      response_format: { type: "json_object" }
    });
    return JSON.parse(completion.choices[0]?.message?.content);
  } catch (error) { return { summary: "Error Profile" }; }
}

async function generateDailyRecap(data) {
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "Ringkasan harian fitness gaya cyberpunk (Bahasa Indonesia)." },
        { role: "user", content: JSON.stringify(data) }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7
    });
    return completion.choices[0]?.message?.content;
  } catch (error) { return "AI Offline."; }
}

module.exports = {
  analyzeFoodText, analyzeFoodImage, analyzeBodyImage, estimateCaloriesBurned, analyzeBodyProfile, generateDailyRecap
};
