FROM node:22-alpine AS frontend-builder

WORKDIR /src

COPY frontend/package*.json ./
RUN npm ci

COPY frontend ./

ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

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
