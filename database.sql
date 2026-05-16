-- OPG Vision — MySQL Schema
-- Run this once in phpMyAdmin (http://localhost/phpmyadmin)
-- Import this file: phpMyAdmin → Import tab → choose this file → Go

CREATE DATABASE IF NOT EXISTS opgvision
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE opgvision;

-- ── Users ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                    INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
  name                  VARCHAR(100)    NOT NULL,
  email                 VARCHAR(200)    NOT NULL,
  password_hash         VARCHAR(255)    NOT NULL,
  plan                  ENUM('free','pro','enterprise') NOT NULL DEFAULT 'free',
  analyses_this_month   INT UNSIGNED    NOT NULL DEFAULT 0,
  created_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Cases ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cases (
  id                        INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
  user_id                   INT UNSIGNED    NOT NULL,
  report_id                 VARCHAR(30)     NOT NULL,
  case_id                   VARCHAR(20)     NOT NULL,
  reference_no              VARCHAR(30)     NOT NULL,
  officer_name              VARCHAR(50)     NOT NULL,
  gender                    VARCHAR(10)     NOT NULL,
  notes                     TEXT,
  estimated_age             DECIMAL(5,2),
  confidence_margin         DECIMAL(5,2),
  age_lower                 DECIMAL(5,2),
  age_upper                 DECIMAL(5,2),
  classification            VARCHAR(20),
  classification_confidence VARCHAR(10),
  is_borderline             TINYINT(1)      NOT NULL DEFAULT 0,
  borderline_warning        TEXT,
  model_version             VARCHAR(50),
  timestamp                 VARCHAR(50),
  created_at                DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
