package main

import (
	"speaker_course/config"
	"speaker_course/internal/logger"

	"github.com/jmoiron/sqlx"
)

func main() {
	// ==== config loader ====
	cfg, err := config.Load()
	if err != nil {
		panic(err)
	}

	log, err := logger.Setup(cfg)
	if err != nil {
		panic(err)
	}
	defer log.Sync()

	cfg.LogConfig(log)

	// ==== db connector ====
	db, err := sqlx.Connect("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Errorf("db connection failed %v", err)
	}
	defer db.Close()
	log.Info("database connected")

	// ==== repository ====

	// ==== service ====

	// ==== handler ====

	// ==== middleware ====

	// ==== router ====

}
