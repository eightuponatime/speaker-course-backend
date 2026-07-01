package main

import (
	"net/http"
	"os"
	"path/filepath"
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
	invitationCodesRepository := repository.NewInvitationCodesRepository(db)
	activityRepository := repository.NewActivityRepository(db)
	mediaAssetsRepository := repository.NewMediaAssetsRepository(db)
	notificationsRepository := repository.NewNotificationsRepository(db)
	quizResponsesRepository := repository.NewQuizResponsesRepository(db)
	txManager := repository.NewTransactionManager(db)

	// ==== service ====
	usersService := service.NewUsersService(usersRepository)
	sessionsService := service.NewSessionsService(cfg, sessionsRepository)
	authService := service.NewAuthService(cfg, usersService, sessionsService)
	coursesService := service.NewCoursesService(coursesRepository, txManager)
	enrollmentsService := service.NewEnrollmentsService(enrollmentsRepository)
	invitationCodesService := service.NewInvitationCodesService(
		cfg,
		invitationCodesRepository,
		enrollmentsRepository,
		txManager,
		authService,
	)
	activityService := service.NewActivityService(activityRepository)
	mediaService := service.NewMediaService(cfg, mediaAssetsRepository)
	notificationsService := service.NewNotificationsService(notificationsRepository)
	quizResponsesService := service.NewQuizResponsesService(quizResponsesRepository)
	emailService := service.NewEmailService(cfg)

	// ==== handler ====
	authHandler := handler.NewAuthHandler(
		cfg,
		authService,
		sessionsService,
		usersService,
		coursesService,
		enrollmentsService,
		invitationCodesService,
		notificationsService,
		emailService,
	)
	coursesHandler := handler.NewCoursesHandler(
		cfg,
		coursesService,
		enrollmentsService,
		invitationCodesService,
		notificationsService,
		quizResponsesService,
		activityService,
		usersService,
		emailService,
	)
	mediaHandler := handler.NewMediaHandler(mediaService)
	notificationsHandler := handler.NewNotificationsHandler(notificationsService)

	// ==== middleware ====
	authMiddleware := middlewarego.NewAuthMiddleware(sessionsService, usersService)

	// ==== router ====
	router := chi.NewRouter()
	router.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "http://localhost:5173", cfg.FrontendURL},
		AllowedMethods:   []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
	}))

	router.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	registerSPAEntry(router, "/admin", "/app/public")
	authHandler.RegisterRoutes(router, authMiddleware)
	coursesHandler.RegisterRoutes(router, authMiddleware)
	mediaHandler.RegisterRoutes(router, authMiddleware)
	notificationsHandler.RegisterRoutes(router, authMiddleware)
	registerStaticFiles(router, "/app/public")

	log.Infof("server listening on :%s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, router); err != nil {
		log.Fatalf("server failed: %v", err)
	}

}

func registerSPAEntry(router chi.Router, route string, root string) {
	indexPath := filepath.Join(root, "index.html")
	if _, err := os.Stat(indexPath); err != nil {
		return
	}

	router.Get(route, func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, indexPath)
	})
}

func registerStaticFiles(router chi.Router, root string) {
	indexPath := filepath.Join(root, "index.html")
	if _, err := os.Stat(indexPath); err != nil {
		return
	}

	fileServer := http.FileServer(http.Dir(root))

	router.Get("/*", func(w http.ResponseWriter, r *http.Request) {
		path := filepath.Clean(r.URL.Path)
		if path == "." || path == "/" {
			http.ServeFile(w, r, indexPath)
			return
		}

		filePath := filepath.Join(root, path)
		info, err := os.Stat(filePath)
		if err == nil && !info.IsDir() {
			fileServer.ServeHTTP(w, r)
			return
		}

		http.ServeFile(w, r, indexPath)
	})
}
