const isPostgres = !!process.env.DATABASE_URL;

let db;
if (isPostgres) {
  console.log('✅ Connecting to PostgreSQL (Cloud Mode)');
  const { Pool } = require('pg');
  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
} else {
  console.log('✅ Connecting to SQLite (Local Mode)');
  const Database = require('better-sqlite3');
  const path = require('path');
  const dbPath = path.join(__dirname, 'tracker.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
}

async function init() {
  const schema = `
    CREATE TABLE IF NOT EXISTS meals (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL DEFAULT CURRENT_DATE,
      time TEXT NOT NULL DEFAULT CURRENT_TIME,
      description TEXT NOT NULL,
      image_path TEXT,
      food_items TEXT,
      calories REAL DEFAULT 0,
      protein REAL DEFAULT 0,
      fat REAL DEFAULT 0,
      cholesterol REAL DEFAULT 0,
      sodium REAL DEFAULT 0,
      carbs REAL DEFAULT 0,
      fiber REAL DEFAULT 0,
      sugar REAL DEFAULT 0,
      ai_response TEXT,
      input_type TEXT DEFAULT 'manual',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS workouts (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL DEFAULT CURRENT_DATE,
      time TEXT NOT NULL DEFAULT CURRENT_TIME,
      type TEXT NOT NULL,
      exercises TEXT NOT NULL,
      total_duration INTEGER DEFAULT 0,
      calories_burned REAL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS profil_logs (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL DEFAULT CURRENT_DATE,
      time TEXT NOT NULL DEFAULT CURRENT_TIME,
      bb REAL NOT NULL,
      tb REAL NOT NULL,
      usia INTEGER NOT NULL,
      gender TEXT NOT NULL,
      activity TEXT NOT NULL,
      goal TEXT NOT NULL,
      bmi REAL DEFAULT 0,
      bmr REAL DEFAULT 0,
      tdee REAL DEFAULT 0,
      target_calories REAL DEFAULT 0,
      target_protein REAL DEFAULT 0,
      target_fat REAL DEFAULT 0,
      target_carbs REAL DEFAULT 0,
      target_cholesterol REAL DEFAULT 0,
      target_sodium REAL DEFAULT 0,
      target_fiber REAL DEFAULT 0,
      target_sugar REAL DEFAULT 0,
      ai_response TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS daily_recaps (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      summary TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, date)
    );
  `;

  if (isPostgres) {
    try {
      await db.query(schema);
      console.log('✅ Database Schema Initialized');
    } catch (e) {
      console.error('❌ Schema Init Error:', e.message);
    }
  } else {
    db.exec(schema.replace(/SERIAL PRIMARY KEY/g, 'INTEGER PRIMARY KEY AUTOINCREMENT').replace(/TIMESTAMP DEFAULT CURRENT_TIMESTAMP/g, 'DATETIME DEFAULT CURRENT_TIMESTAMP'));
  }
}

async function query(sql, params = []) {
  if (isPostgres) {
    // Convert ? to $1, $2, etc for Postgres
    let i = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++i}`);
    const res = await db.query(pgSql, params);
    return res.rows;
  } else {
    return db.prepare(sql).all(params);
  }
}

async function run(sql, params = []) {
  if (isPostgres) {
    let i = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++i}`);
    const res = await db.query(pgSql, params);
    return { lastInsertId: res.insertId };
  } else {
    const result = db.prepare(sql).run(params);
    return { lastInsertId: result.lastInsertRowid };
  }
}

async function get(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

// ... rest of the functions remain the same but use the new query/run/get wrappers
async function addMeal(data) {
  const sql = `INSERT INTO meals (user_id, date, time, description, image_path, food_items, calories, protein, fat, cholesterol, sodium, carbs, fiber, sugar, ai_response, input_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const res = await run(sql, [data.user_id, data.date, data.time, data.description, data.image_path, JSON.stringify(data.food_items), data.calories, data.protein, data.fat, data.cholesterol, data.sodium, data.carbs, data.fiber, data.sugar, JSON.stringify(data.ai_response), data.input_type]);
  return { id: res.lastInsertId, ...data };
}

async function getMealsByDate(user_id, date) {
  return query(`SELECT * FROM meals WHERE user_id = ? AND date = ? ORDER BY time DESC`, [user_id, date]);
}

async function deleteMeal(user_id, id) {
  return run(`DELETE FROM meals WHERE user_id = ? AND id = ?`, [user_id, id]);
}

async function addWorkout(data) {
  const sql = `INSERT INTO workouts (user_id, date, time, type, exercises, total_duration, calories_burned, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  const res = await run(sql, [data.user_id, data.date, data.time, data.type, JSON.stringify(data.exercises), data.total_duration, data.calories_burned, data.notes]);
  return { id: res.lastInsertId, ...data };
}

async function getWorkoutsByDate(user_id, date) {
  return query(`SELECT * FROM workouts WHERE user_id = ? AND date = ? ORDER BY time DESC`, [user_id, date]);
}

async function deleteWorkout(user_id, id) {
  return run(`DELETE FROM workouts WHERE user_id = ? AND id = ?`, [user_id, id]);
}

async function getDashboardStats(user_id, startDate, endDate) {
  const mealStats = await get(`SELECT COUNT(*) as total_meals, COALESCE(SUM(calories),0) as total_calories, COALESCE(SUM(protein),0) as total_protein FROM meals WHERE user_id = ? AND date BETWEEN ? AND ?`, [user_id, startDate, endDate]);
  const workoutStats = await get(`SELECT COUNT(*) as total_workouts, COALESCE(SUM(calories_burned),0) as total_calories_burned FROM workouts WHERE user_id = ? AND date BETWEEN ? AND ?`, [user_id, startDate, endDate]);
  const dailyCalories = await query(`SELECT date, SUM(calories) as calories FROM meals WHERE user_id = ? AND date BETWEEN ? AND ? GROUP BY date ORDER BY date`, [user_id, startDate, endDate]);
  return { meals: mealStats, workouts: workoutStats, dailyCalories };
}

async function addProfilLog(data) {
  const sql = `INSERT INTO profil_logs (user_id, date, time, bb, tb, usia, gender, activity, goal, bmi, bmr, tdee, target_calories, target_protein, target_fat, target_carbs, ai_response) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const res = await run(sql, [data.user_id, data.date, data.time, data.bb, data.tb, data.usia, data.gender, data.activity, data.goal, data.bmi, data.bmr, data.tdee, data.target_calories, data.target_protein, data.target_fat, data.target_carbs, JSON.stringify(data.ai_response)]);
  return { id: res.lastInsertId, ...data };
}

async function getLatestProfilLog(user_id) {
  return get(`SELECT * FROM profil_logs WHERE user_id = ? ORDER BY id DESC LIMIT 1`, [user_id]);
}

async function upsertDailyRecap(user_id, date, summary) {
  const existing = await get(`SELECT * FROM daily_recaps WHERE user_id = ? AND date = ?`, [user_id, date]);
  if (existing) return run(`UPDATE daily_recaps SET summary = ? WHERE user_id = ? AND date = ?`, [summary, user_id, date]);
  return run(`INSERT INTO daily_recaps (user_id, date, summary) VALUES (?, ?, ?)`, [user_id, date, summary]);
}

async function getDailyRecap(user_id, date) {
  return get(`SELECT * FROM daily_recaps WHERE user_id = ? AND date = ?`, [user_id, date]);
}

module.exports = {
  init, addMeal, getMealsByDate, deleteMeal, addWorkout, getWorkoutsByDate, deleteWorkout,
  getDashboardStats, addProfilLog, getLatestProfilLog, upsertDailyRecap, getDailyRecap
};
