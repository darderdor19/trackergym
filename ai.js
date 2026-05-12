const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ========================
// ANALYZE FOOD TEXT (Manual Input)
// ========================
async function analyzeFoodText(description) {
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `Kamu adalah ahli nutrisi profesional. Ketika user mendeskripsikan makanan, kamu harus menganalisis dan mengembalikan data nutrisi dalam format JSON yang STRICT.
          
PENTING: Response HARUS berupa JSON valid tanpa teks tambahan. Format:
{
  "food_items": [
    { "name": "nama makanan", "amount": "jumlah gram", "grams": 100 }
  ],
  "nutrition": {
    "calories": 0,
    "protein": 0,
    "fat": 0,
    "cholesterol": 0,
    "sodium": 0,
    "carbs": 0,
    "fiber": 0,
    "sugar": 0
  },
  "summary": "ringkasan singkat dalam bahasa Indonesia"
}

Semua nilai nutrisi dalam satuan:
- calories: kkal
- protein, fat, carbs, fiber, sugar: gram
- cholesterol, sodium: mg

Berikan estimasi yang akurat berdasarkan database nutrisi umum.`
        },
        {
          role: "user",
          content: description
        }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      max_tokens: 1024,
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0]?.message?.content;
    return JSON.parse(content);
  } catch (error) {
    console.error('Error analyzing food text:', error.message);
    return estimateFoodFromText(description);
  }
}

// ========================
// ANALYZE FOOD IMAGE
// ========================
async function analyzeFoodImage(imagePath) {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analisis foto makanan ini secara mendalam. Identifikasi semua item makanan, porsi/jumlahnya, dan hitung total nutrisinya.
              
PENTING: Response HARUS berupa JSON valid tanpa teks tambahan. Format:
{
  "food_items": [
    { "name": "nama makanan", "amount": "estimasi porsi", "grams": 100 }
  ],
  "nutrition": {
    "calories": 0,
    "protein": 0,
    "fat": 0,
    "cholesterol": 0,
    "sodium": 0,
    "carbs": 0,
    "fiber": 0,
    "sugar": 0
  },
  "summary": "ringkasan nutrisi lengkap dalam bahasa Indonesia"
}`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            }
          ]
        }
      ],
      model: "llama-3.2-11b-vision-preview",
      temperature: 0.1,
      max_tokens: 1024,
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0]?.message?.content;
    return JSON.parse(content);
  } catch (error) {
    console.error('Error analyzing food image:', error.message);
    return {
      food_items: [{ name: "Error Analisis", amount: "N/A", grams: 0 }],
      nutrition: { calories: 0, protein: 0, fat: 0, cholesterol: 0, sodium: 0, carbs: 0, fiber: 0, sugar: 0 },
      summary: "Gagal menganalisis gambar. Pastikan API Key benar dan format gambar didukung. Error: " + error.message
    };
  }
}

// ... rest of the file stays the same
async function analyzeBodyImage(imagePath) {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analisis foto tubuh ini sebagai fitness consultant profesional. Berikan assessment kondisi tubuh dan rekomendasi.

PENTING: Response HARUS berupa JSON valid tanpa teks tambahan. Format:
{
  "body_assessment": {
    "body_fat_estimate": "estimasi persentase lemak tubuh",
    "muscle_assessment": "penilaian massa otot",
    "posture": "penilaian postur",
    "overall_condition": "kondisi keseluruhan"
  },
  "recommendations": {
    "goal": "rekomendasi goal (bulking/cutting/maintaining)",
    "diet_strategy": "strategi diet detail",
    "workout_focus": ["area fokus latihan 1", "area fokus latihan 2"],
    "exercises": [
      { "name": "nama gerakan", "sets": 3, "reps": "8-12", "notes": "catatan" }
    ],
    "weekly_plan": "rencana mingguan singkat",
    "tips": ["tip 1", "tip 2", "tip 3"]
  },
  "summary": "ringkasan keseluruhan dalam bahasa Indonesia"
}`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            }
          ]
        }
      ],
      model: "llama-3.2-11b-vision-preview",
      temperature: 0.1,
      max_tokens: 2048,
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0]?.message?.content;
    return JSON.parse(content);
  } catch (error) {
    console.error('Error analyzing body image:', error.message);
    return {
      body_assessment: { body_fat_estimate: "N/A", muscle_assessment: "N/A", posture: "N/A", overall_condition: "Error" },
      recommendations: { goal: "Error", diet_strategy: "-", workout_focus: [], exercises: [], weekly_plan: "-", tips: [] },
      summary: "Gagal menganalisis gambar. Error: " + error.message
    };
  }
}

async function estimateCaloriesBurned(workoutData) {
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `Kamu adalah ahli fitness. Estimasi kalori yang terbakar berdasarkan data workout yang diberikan. Response HARUS berupa JSON valid.
Format: { "calories_burned": 0, "intensity": "low/medium/high", "notes": "catatan singkat" }`
        },
        {
          role: "user",
          content: JSON.stringify(workoutData)
        }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      max_tokens: 256,
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0]?.message?.content;
    return JSON.parse(content);
  } catch (error) {
    console.error('Error estimating calories:', error.message);
    const duration = workoutData.total_duration || 30;
    const multiplier = workoutData.type === 'cardio' ? 10 : workoutData.type === 'gym' ? 7 : 8;
    return { calories_burned: Math.round(duration * multiplier), intensity: "medium", notes: "Estimasi lokal (AI tidak tersedia)" };
  }
}

function estimateFoodFromText(description) {
  const lower = description.toLowerCase();
  let calories = 200, protein = 10, fat = 5, carbs = 30;
  if (lower.includes('ayam')) { calories = 250; protein = 30; fat = 12; carbs = 0; }
  if (lower.includes('nasi')) { calories += 200; carbs += 45; protein += 4; }
  return {
    food_items: [{ name: description, amount: 'estimasi', grams: 100 }],
    nutrition: { calories, protein, fat, cholesterol: 50, sodium: 300, carbs, fiber: 2, sugar: 3 },
    summary: `Estimasi lokal untuk: ${description} (AI offline)`
  };
}

async function analyzeBodyProfile(profileData) {
  try {
    const { bb, tb, usia, gender, activity, goal, bmi, bmr, tdee } = profileData;
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `Kamu adalah ahli nutrisi profesional. Berikan analisis kebutuhan nutrisi harian detail dalam JSON. Response HARUS JSON valid.`
        },
        {
          role: "user",
          content: `Data: ${JSON.stringify(profileData)}`
        }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      max_tokens: 2048,
      response_format: { type: "json_object" }
    });
    return JSON.parse(completion.choices[0]?.message?.content);
  } catch (error) {
    return { summary: "Error AI Profile" };
  }
}

async function generateDailyRecap(data) {
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "Kamu adalah LebihFit Coach. Berikan ringkasan harian cyberpunk." },
        { role: "user", content: JSON.stringify(data) }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 1024
    });
    return completion.choices[0]?.message?.content;
  } catch (error) {
    return "AI Offline, keep consistent!";
  }
}

module.exports = {
  analyzeFoodText, analyzeFoodImage, analyzeBodyImage, estimateCaloriesBurned, analyzeBodyProfile, generateDailyRecap
};
