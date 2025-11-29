import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default class DatabaseManager {
  constructor() {
    this.db = null;
    this.dbPath = join(__dirname, '../../data/ranked.db');
    this.SQL = null;
  }

  async init() {
    this.SQL = await initSqlJs();
    
    // Charger la base existante ou créer une nouvelle
    if (existsSync(this.dbPath)) {
      const buffer = readFileSync(this.dbPath);
      this.db = new this.SQL.Database(buffer);
    } else {
      this.db = new this.SQL.Database();
    }
    
    this.createTables();
    this.save();
    console.log('✅ Base de données initialisée');
  }

  save() {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    writeFileSync(this.dbPath, buffer);
  }

  createTables() {
    // Table des joueurs
    this.db.run(`
      CREATE TABLE IF NOT EXISTS players (
        user_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        elo INTEGER DEFAULT 1000,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        draws INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table des matchs
    this.db.run(`
      CREATE TABLE IF NOT EXISTS matches (
        match_id INTEGER PRIMARY KEY AUTOINCREMENT,
        player1_id TEXT NOT NULL,
        player2_id TEXT NOT NULL,
        winner_id TEXT,
        player1_score INTEGER,
        player2_score INTEGER,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table des équipes (pour les matchs en équipe si besoin)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS teams (
        team_id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_name TEXT NOT NULL,
        captain_id TEXT NOT NULL,
        elo INTEGER DEFAULT 1000,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table des confirmations de matchs
    this.db.run(`
      CREATE TABLE IF NOT EXISTS match_confirmations (
        confirmation_id TEXT PRIMARY KEY,
        player1_id TEXT NOT NULL,
        player2_id TEXT NOT NULL,
        player1_score INTEGER NOT NULL,
        player2_score INTEGER NOT NULL,
        message_id TEXT,
        confirmed_by_player1 INTEGER DEFAULT 0,
        confirmed_by_player2 INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table du matchmaking
    this.db.run(`
      CREATE TABLE IF NOT EXISTS matchmaking_queue (
        user_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        elo INTEGER NOT NULL,
        dm_message_id TEXT,
        search_started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        elo_range_expanded INTEGER DEFAULT 0
      )
    `);

    // Table des matchs actifs (trouvés via matchmaking)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS active_matches (
        match_id TEXT PRIMARY KEY,
        player1_id TEXT NOT NULL,
        player2_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        reminder_sent INTEGER DEFAULT 0
      )
    `);

    // Table d'historique ELO pour tracker les changements
    this.db.run(`
      CREATE TABLE IF NOT EXISTS elo_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        elo INTEGER NOT NULL,
        match_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES players(user_id),
        FOREIGN KEY (match_id) REFERENCES matches(match_id)
      )
    `);

    // Table des records/milestones
    this.db.run(`
      CREATE TABLE IF NOT EXISTS records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        record_type TEXT NOT NULL,
        record_value INTEGER NOT NULL,
        match_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES players(user_id)
      )
    `);
  }

  // Méthodes pour les joueurs
  registerPlayer(userId, username) {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO players (user_id, username) 
      VALUES (?, ?)
    `);
    stmt.bind([userId, username]);
    stmt.step();
    stmt.free();
    this.save();
    return { changes: this.db.getRowsModified() };
  }

  getPlayer(userId) {
    const stmt = this.db.prepare('SELECT * FROM players WHERE user_id = ?');
    stmt.bind([userId]);
    const result = stmt.step() ? this.rowToObject(stmt.getAsObject()) : null;
    stmt.free();
    return result;
  }

  updatePlayerElo(userId, newElo) {
    const stmt = this.db.prepare('UPDATE players SET elo = ? WHERE user_id = ?');
    stmt.bind([newElo, userId]);
    stmt.step();
    stmt.free();
    this.save();
    return { changes: this.db.getRowsModified() };
  }

  updatePlayerStats(userId, wins, losses, draws) {
    const stmt = this.db.prepare(`
      UPDATE players 
      SET wins = wins + ?, losses = losses + ?, draws = draws + ?
      WHERE user_id = ?
    `);
    stmt.bind([wins, losses, draws, userId]);
    stmt.step();
    stmt.free();
    this.save();
    return { changes: this.db.getRowsModified() };
  }

  getLeaderboard(limit = 10) {
    const stmt = this.db.prepare(`
      SELECT * FROM players 
      ORDER BY elo DESC 
      LIMIT ?
    `);
    stmt.bind([limit]);
    const results = [];
    while (stmt.step()) {
      results.push(this.rowToObject(stmt.getAsObject()));
    }
    stmt.free();
    return results;
  }

  // Méthodes pour les matchs
  createMatch(player1Id, player2Id) {
    const stmt = this.db.prepare(`
      INSERT INTO matches (player1_id, player2_id, status)
      VALUES (?, ?, 'pending')
    `);
    stmt.bind([player1Id, player2Id]);
    stmt.step();
    stmt.free();
    this.save();
    
    // Récupérer l'ID du dernier match inséré
    const lastIdStmt = this.db.prepare('SELECT last_insert_rowid() as id');
    lastIdStmt.step();
    const lastId = lastIdStmt.getAsObject().id;
    lastIdStmt.free();
    
    return { lastInsertRowid: lastId };
  }

  updateMatch(matchId, winnerId, player1Score, player2Score) {
    const stmt = this.db.prepare(`
      UPDATE matches 
      SET winner_id = ?, player1_score = ?, player2_score = ?, status = 'completed'
      WHERE match_id = ?
    `);
    stmt.bind([winnerId, player1Score, player2Score, matchId]);
    stmt.step();
    stmt.free();
    this.save();
    return { changes: this.db.getRowsModified() };
  }

  getMatch(matchId) {
    const stmt = this.db.prepare('SELECT * FROM matches WHERE match_id = ?');
    stmt.bind([matchId]);
    const result = stmt.step() ? this.rowToObject(stmt.getAsObject()) : null;
    stmt.free();
    return result;
  }

  getPlayerMatches(userId, limit = 10) {
    const stmt = this.db.prepare(`
      SELECT * FROM matches 
      WHERE player1_id = ? OR player2_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    stmt.bind([userId, userId, limit]);
    const results = [];
    while (stmt.step()) {
      results.push(this.rowToObject(stmt.getAsObject()));
    }
    stmt.free();
    return results;
  }

  // Méthodes pour les confirmations
  createMatchConfirmation(confirmationId, player1Id, player2Id, player1Score, player2Score, messageId) {
    const stmt = this.db.prepare(`
      INSERT INTO match_confirmations 
      (confirmation_id, player1_id, player2_id, player1_score, player2_score, message_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.bind([confirmationId, player1Id, player2Id, player1Score, player2Score, messageId]);
    stmt.step();
    stmt.free();
    this.save();
    return { changes: this.db.getRowsModified() };
  }

  getMatchConfirmation(confirmationId) {
    const stmt = this.db.prepare('SELECT * FROM match_confirmations WHERE confirmation_id = ?');
    stmt.bind([confirmationId]);
    const result = stmt.step() ? this.rowToObject(stmt.getAsObject()) : null;
    stmt.free();
    return result;
  }

  confirmMatch(confirmationId, playerId) {
    const confirmation = this.getMatchConfirmation(confirmationId);
    if (!confirmation) return null;

    let updateField = '';
    if (confirmation.player1_id === playerId) {
      updateField = 'confirmed_by_player1';
    } else if (confirmation.player2_id === playerId) {
      updateField = 'confirmed_by_player2';
    } else {
      return null;
    }

    const stmt = this.db.prepare(`
      UPDATE match_confirmations 
      SET ${updateField} = 1
      WHERE confirmation_id = ?
    `);
    stmt.bind([confirmationId]);
    stmt.step();
    stmt.free();
    this.save();

    // Récupérer la confirmation mise à jour
    return this.getMatchConfirmation(confirmationId);
  }

  deleteMatchConfirmation(confirmationId) {
    const stmt = this.db.prepare('DELETE FROM match_confirmations WHERE confirmation_id = ?');
    stmt.bind([confirmationId]);
    stmt.step();
    stmt.free();
    this.save();
    return { changes: this.db.getRowsModified() };
  }

  getPendingConfirmations() {
    // Récupérer les confirmations sans message_id (créées depuis le dashboard)
    const stmt = this.db.prepare(`
      SELECT * FROM match_confirmations 
      WHERE message_id IS NULL OR message_id = ''
      ORDER BY created_at DESC
    `);
    const results = [];
    while (stmt.step()) {
      results.push(this.rowToObject(stmt.getAsObject()));
    }
    stmt.free();
    return results;
  }

  updateMatchConfirmationMessageId(confirmationId, messageId) {
    const stmt = this.db.prepare('UPDATE match_confirmations SET message_id = ? WHERE confirmation_id = ?');
    stmt.bind([messageId, confirmationId]);
    stmt.step();
    stmt.free();
    this.save();
    return { changes: this.db.getRowsModified() };
  }

  // Méthodes pour le matchmaking
  addToMatchmakingQueue(userId, username, elo, dmMessageId) {
    // Générer un timestamp ISO 8601 en UTC pour éviter les problèmes de décalage horaire
    const now = new Date().toISOString();
    
    // Vérifier si le joueur est déjà dans la queue
    const existing = this.getPlayerInQueue(userId);
    
    if (existing) {
      // Mettre à jour avec un nouveau timestamp
      const stmt = this.db.prepare(`
        UPDATE matchmaking_queue 
        SET username = ?, elo = ?, dm_message_id = ?, search_started_at = ?, elo_range_expanded = 0
        WHERE user_id = ?
      `);
      stmt.bind([username, elo, dmMessageId, now, userId]);
      stmt.step();
      stmt.free();
    } else {
      // Nouvelle insertion
      const stmt = this.db.prepare(`
        INSERT INTO matchmaking_queue (user_id, username, elo, dm_message_id, search_started_at, elo_range_expanded)
        VALUES (?, ?, ?, ?, ?, 0)
      `);
      stmt.bind([userId, username, elo, dmMessageId, now]);
      stmt.step();
      stmt.free();
    }
    
    this.save();
    return { changes: this.db.getRowsModified() };
  }

  removeFromMatchmakingQueue(userId) {
    const stmt = this.db.prepare('DELETE FROM matchmaking_queue WHERE user_id = ?');
    stmt.bind([userId]);
    stmt.step();
    stmt.free();
    this.save();
    return { changes: this.db.getRowsModified() };
  }

  getMatchmakingQueue() {
    const stmt = this.db.prepare('SELECT * FROM matchmaking_queue ORDER BY search_started_at ASC');
    const results = [];
    while (stmt.step()) {
      results.push(this.rowToObject(stmt.getAsObject()));
    }
    stmt.free();
    return results;
  }

  getPlayerInQueue(userId) {
    const stmt = this.db.prepare('SELECT * FROM matchmaking_queue WHERE user_id = ?');
    stmt.bind([userId]);
    const result = stmt.step() ? this.rowToObject(stmt.getAsObject()) : null;
    stmt.free();
    return result;
  }

  findMatchForPlayer(userId, eloRange = 100) {
    const player = this.getPlayerInQueue(userId);
    if (!player) return null;

    const stmt = this.db.prepare(`
      SELECT * FROM matchmaking_queue 
      WHERE user_id != ? 
      AND elo BETWEEN ? AND ?
      ORDER BY ABS(elo - ?) ASC
      LIMIT 1
    `);
    stmt.bind([userId, player.elo - eloRange, player.elo + eloRange, player.elo]);
    const result = stmt.step() ? this.rowToObject(stmt.getAsObject()) : null;
    stmt.free();
    return result;
  }

  expandEloRange(userId) {
    const stmt = this.db.prepare('UPDATE matchmaking_queue SET elo_range_expanded = 1 WHERE user_id = ?');
    stmt.bind([userId]);
    stmt.step();
    stmt.free();
    this.save();
    return { changes: this.db.getRowsModified() };
  }

  // Méthodes pour les matchs actifs
  createActiveMatch(matchId, player1Id, player2Id, channelId) {
    const stmt = this.db.prepare(`
      INSERT INTO active_matches (match_id, player1_id, player2_id, channel_id)
      VALUES (?, ?, ?, ?)
    `);
    stmt.bind([matchId, player1Id, player2Id, channelId]);
    stmt.step();
    stmt.free();
    this.save();
    return { changes: this.db.getRowsModified() };
  }

  getActiveMatch(channelId) {
    const stmt = this.db.prepare('SELECT * FROM active_matches WHERE channel_id = ?');
    stmt.bind([channelId]);
    const result = stmt.step() ? this.rowToObject(stmt.getAsObject()) : null;
    stmt.free();
    return result;
  }

  getActiveMatchByPlayer(userId) {
    const stmt = this.db.prepare('SELECT * FROM active_matches WHERE player1_id = ? OR player2_id = ?');
    stmt.bind([userId, userId]);
    const result = stmt.step() ? this.rowToObject(stmt.getAsObject()) : null;
    stmt.free();
    return result;
  }

  deleteActiveMatch(matchId) {
    const stmt = this.db.prepare('DELETE FROM active_matches WHERE match_id = ?');
    stmt.bind([matchId]);
    stmt.step();
    stmt.free();
    this.save();
    return { changes: this.db.getRowsModified() };
  }

  markReminderSent(channelId) {
    const stmt = this.db.prepare('UPDATE active_matches SET reminder_sent = 1 WHERE channel_id = ?');
    stmt.bind([channelId]);
    stmt.step();
    stmt.free();
    this.save();
    return { changes: this.db.getRowsModified() };
  }

  getAllActiveMatches() {
    const stmt = this.db.prepare('SELECT * FROM active_matches');
    const results = [];
    while (stmt.step()) {
      results.push(this.rowToObject(stmt.getAsObject()));
    }
    stmt.free();
    return results;
  }

  // Méthodes pour les statistiques avancées
  getPlayerRank(userId) {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) + 1 as rank
      FROM players
      WHERE elo > (SELECT elo FROM players WHERE user_id = ?)
    `);
    stmt.bind([userId]);
    const result = stmt.step() ? this.rowToObject(stmt.getAsObject()) : null;
    stmt.free();
    return result?.rank || 0;
  }

  getPlayerWinStreak(userId) {
    const matches = this.getPlayerMatches(userId, 100);
    let streak = 0;
    
    // Les matchs sont déjà triés du plus récent au plus ancien
    for (const match of matches) {
      if (match.status !== 'completed') continue;
      if (match.player1_score === null || match.player2_score === null) continue;
      
      const won = match.winner_id === userId;
      const draw = match.winner_id === null || match.winner_id === '';
      
      if (draw) break; // Un nul casse la série
      if (won) streak++;
      else break; // Une défaite casse la série
    }
    
    return streak;
  }

  getPlayerBestElo(userId) {
    // On va stocker le meilleur ELO dans une nouvelle colonne ou le calculer
    // Pour l'instant, on va juste retourner l'ELO actuel (on pourrait améliorer avec une table d'historique)
    const player = this.getPlayer(userId);
    return player?.elo || 1000;
  }

  getPlayerAverageScore(userId) {
    const matches = this.getPlayerMatches(userId, 100);
    if (matches.length === 0) return 0;
    
    let totalScore = 0;
    let count = 0;
    
    for (const match of matches) {
      if (match.status !== 'completed') continue;
      const isPlayer1 = match.player1_id === userId;
      totalScore += isPlayer1 ? match.player1_score : match.player2_score;
      count++;
    }
    
    return count > 0 ? Math.round(totalScore / count * 10) / 10 : 0;
  }

  // Méthodes pour l'historique ELO
  getEloHistory(userId, limit = 50) {
    const stmt = this.db.prepare(`
      SELECT * FROM elo_history 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    stmt.bind([userId, limit]);
    const results = [];
    while (stmt.step()) {
      results.push(this.rowToObject(stmt.getAsObject()));
    }
    stmt.free();
    return results;
  }

  // Méthodes pour les records
  checkAndSaveRecord(userId, recordType, recordValue, matchId = null) {
    // Vérifier si c'est un nouveau record
    const stmt = this.db.prepare(`
      SELECT MAX(record_value) as max_value 
      FROM records 
      WHERE user_id = ? AND record_type = ?
    `);
    stmt.bind([userId, recordType]);
    const result = stmt.step() ? this.rowToObject(stmt.getAsObject()) : null;
    stmt.free();
    
    const currentMax = result?.max_value || 0;
    
    if (recordValue > currentMax) {
      // Nouveau record !
      const insertStmt = this.db.prepare(`
        INSERT INTO records (user_id, record_type, record_value, match_id)
        VALUES (?, ?, ?, ?)
      `);
      insertStmt.bind([userId, recordType, recordValue, matchId]);
      insertStmt.step();
      insertStmt.free();
      this.save();
      return { isNewRecord: true, previousRecord: currentMax, newRecord: recordValue };
    }
    
    return { isNewRecord: false, currentRecord: currentMax };
  }

  getPlayerRecords(userId) {
    const stmt = this.db.prepare(`
      SELECT record_type, MAX(record_value) as record_value, created_at
      FROM records
      WHERE user_id = ?
      GROUP BY record_type
    `);
    stmt.bind([userId]);
    const results = [];
    while (stmt.step()) {
      results.push(this.rowToObject(stmt.getAsObject()));
    }
    stmt.free();
    return results;
  }

  // Comparer deux joueurs
  comparePlayers(userId1, userId2) {
    const player1 = this.getPlayer(userId1);
    const player2 = this.getPlayer(userId2);
    
    if (!player1 || !player2) return null;
    
    // Matchs entre les deux joueurs (seulement complétés avec scores valides)
    const allMatches = this.getPlayerMatches(userId1, 100);
    const matches = allMatches.filter(m => 
      m.status === 'completed' &&
      m.player1_score !== null &&
      m.player2_score !== null &&
      ((m.player1_id === userId1 && m.player2_id === userId2) ||
       (m.player1_id === userId2 && m.player2_id === userId1))
    );
    
    let wins1 = 0, wins2 = 0, draws = 0;
    for (const match of matches) {
      // Vérifier que winner_id existe et n'est pas vide
      if (match.winner_id && match.winner_id === userId1) {
        wins1++;
      } else if (match.winner_id && match.winner_id === userId2) {
        wins2++;
      } else {
        // Si winner_id est null/vide, c'est un nul
        draws++;
      }
    }
    
    return {
      player1: { ...player1, wins: wins1, losses: wins2, draws },
      player2: { ...player2, wins: wins2, losses: wins1, draws },
      totalMatches: matches.length,
      headToHead: { wins1, wins2, draws }
    };
  }

  // Helper pour convertir les résultats en objets
  rowToObject(row) {
    const obj = {};
    for (const key in row) {
      obj[key] = row[key];
    }
    return obj;
  }
}
