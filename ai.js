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

// ========================
// ANALYZE FOOD TEXT (Groq)
// ========================
async function analyzeFoodText(description) {
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `Kamu adalah ahli nutrisi profesional. Menganalisis makanan dan mengembalikan data nutrisi dalam format JSON STRICT.
Response HARUS JSON valid:
{
  "food_items": [ { "name": "nama", "amount": "jumlah", "grams": 100 } ],
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
    return estimateFoodFromText(description);
  }
}

// ========================
// ANALYZE FOOD IMAGE (Gemini)
// ========================
async function analyzeFoodImage(imagePath) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const imageBuffer = fs.readFileSync(imagePath);
    
    const prompt = `Analisis foto makanan ini. Identifikasi item, porsi, dan hitung total nutrisinya.
    Kembalikan HANYA dalam format JSON valid seperti ini:
    {
      "food_items": [ { "name": "nama makanan", "amount": "porsi", "grams": 100 } ],
      "nutrition": { "calories": 0, "protein": 0, "fat": 0, "cholesterol": 0, "sodium": 0, "carbs": 0, "fiber": 0, "sugar": 0 },
      "summary": "ringkasan singkat bahasa Indonesia"
    }`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBuffer.toString("base64"),
          mimeType: "image/jpeg"
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch (error) {
    console.error('Gemini Image Error:', error.message);
    return { summary: "Gagal analisis gambar via Gemini: " + error.message };
  }
}

// ========================
// ANALYZE BODY SCAN (Gemini)
// ========================
async function analyzeBodyImage(imagePath) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const imageBuffer = fs.readFileSync(imagePath);
    
    const prompt = `Analisis foto tubuh ini sebagai fitness consultant. Berikan assessment dan rekomendasi.
    Kembalikan HANYA dalam format JSON valid:
    {
      "body_assessment": { "body_fat_estimate": "...", "muscle_assessment": "...", "posture": "...", "overall_condition": "..." },
      "recommendations": { "goal": "...", "diet_strategy": "...", "workout_focus": [], "exercises": [], "weekly_plan": "...", "tips": [] },
      "summary": "ringkasan bahasa Indonesia"
    }`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBuffer.toString("base64"),
          mimeType: "image/jpeg"
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch (error) {
    console.error('Gemini Body Error:', error.message);
    return { summary: "Gagal analisis tubuh via Gemini: " + error.message };
  }
}

// ========================
// WORKOUT & PROFILE (Groq)
// ========================
async function estimateCaloriesBurned(workoutData) {
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "Estimasi kalori workout dalam JSON: { \"calories_burned\": 0, \"intensity\": \"low/medium/high\", \"notes\": \"...\" }" },
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
        { role: "system", content: "Berikan analisis nutrisi harian detail dalam JSON valid." },
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
        { role: "system", content: "Berikan ringkasan harian fitness gaya cyberpunk dalam bahasa Indonesia." },
        { role: "user", content: JSON.stringify(data) }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7
    });
    return completion.choices[0]?.message?.content;
  } catch (error) { return "AI Offline, stay strong!"; }
}

function estimateFoodFromText(description) {
  return { nutrition: { calories: 250 }, summary: "Estimasi lokal (AI Offline)" };
}

module.exports = {
  analyzeFoodText, analyzeFoodImage, analyzeBodyImage, estimateCaloriesBurned, analyzeBodyProfile, generateDailyRecap
};
