FROM node:22-alpine AS frontend-builder

WORKDIR /src

COPY frontend/package*.json ./
RUN npm ci

COPY frontend ./

ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ARG BUNNY_STREAM_LIBRARY_ID=673250
ARG BUNNY_STREAM_CDN_HOSTNAME=video.umbra.kz
ARG BUNNY_STORAGE_PUBLIC_BASE_URL=https://cdn.umbra.kz
ENV BUNNY_STREAM_LIBRARY_ID=$BUNNY_STREAM_LIBRARY_ID \
    BUNNY_STREAM_CDN_HOSTNAME=$BUNNY_STREAM_CDN_HOSTNAME \
    BUNNY_STORAGE_PUBLIC_BASE_URL=$BUNNY_STORAGE_PUBLIC_BASE_URL

RUN npm run build

FROM golang:1.25-alpine AS builder

WORKDIR /src

RUN apk add --no-cache ca-certificates

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend ./
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/speaker-course ./cmd

FROM alpine:3.20

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /out/speaker-course /app/speaker-course
COPY --from=frontend-builder /src/dist /app/public

EXPOSE 8080

CMD ["/app/speaker-course"]
