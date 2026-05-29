package config

import (
	"log"
	"os"
	"time"

	"github.com/joho/godotenv"
	"go.uber.org/zap"
)

type Config struct {
	DatabaseURL      string
	Port             string
	Env              string
	BusinessTimezone string
	SessionTTL       time.Duration
}

func Load() (*Config, error) {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file")
	}

	return &Config{
		DatabaseURL:      getEnv("DATABASE_URL", ""),
		Port:             getEnv("PORT", "8080"),
		Env:              getEnv("ENV", "development"),
		BusinessTimezone: getEnv("BUSINESS_TIMEZONE", "Asia/Almaty"),
		SessionTTL:       getDurationEnv("SESSION_TTL", 30*24*time.Hour),
	}, nil
}

func getEnv(key string, fallback string) string {
	value, ok := os.LookupEnv(key)
	if ok {
		return value
	}
	return fallback
}

func getDurationEnv(key string, fallback time.Duration) time.Duration {

	sessionTTL, ok := os.LookupEnv(key)

	if !ok {
		return fallback
	}

	duration, err := time.ParseDuration(sessionTTL)
	if err != nil {
		return fallback
	}

	return duration
}

func (c *Config) LogConfig(logger *zap.SugaredLogger) {
	logger.Infow(
		"config loaded",
		"port", c.Port,
		"env", c.Env,
		"business timezone", c.BusinessTimezone,
	)
}
