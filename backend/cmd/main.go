package main

import (
	"net/http"
	"speaker_course/config"
	"speaker_course/internal/handler"
	"speaker_course/internal/logger"
	middlewarego "speaker_course/internal/middleware.go"
	"speaker_course/internal/repository"
	"speaker_course/internal/service"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
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
		log.Fatalf("db connection failed %v", err)
	}
	defer db.Close()
	log.Info("database connected")

	// ==== repository ====
	usersRepository := repository.NewUsersRepository(db)
	sessionsRepository := repository.NewSessionsRepository(db)
	coursesRepository := repository.NewCoursesRepository(db)
	enrollmentsRepository := repository.NewEnrollmentsRepository(db)
	mediaAssetsRepository := repository.NewMediaAssetsRepository(db)

	// ==== service ====
	usersService := service.NewUsersService(usersRepository)
	sessionsService := service.NewSessionsService(cfg, sessionsRepository)
	authService := service.NewAuthService(cfg, usersService, sessionsService)
	coursesService := service.NewCoursesService(coursesRepository)
	enrollmentsService := service.NewEnrollmentsService(enrollmentsRepository)
	mediaService := service.NewMediaService(cfg, mediaAssetsRepository)

	// ==== handler ====
	authHandler := handler.NewAuthHandler(cfg, authService, sessionsService, usersService)
	coursesHandler := handler.NewCoursesHandler(coursesService, enrollmentsService)
	mediaHandler := handler.NewMediaHandler(mediaService)

	// ==== middleware ====
	authMiddleware := middlewarego.NewAuthMiddleware(sessionsService, usersService)

	// ==== router ====
	router := chi.NewRouter()
	router.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "http://localhost:5173"},
		AllowedMethods:   []string{"GET", "POST", "PATCH", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
	}))

	router.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	authHandler.RegisterRoutes(router, authMiddleware)
	coursesHandler.RegisterRoutes(router, authMiddleware)
	mediaHandler.RegisterRoutes(router, authMiddleware)

	log.Infof("server listening on :%s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, router); err != nil {
		log.Fatalf("server failed: %v", err)
	}

}
