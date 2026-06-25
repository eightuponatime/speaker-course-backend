FROM node:22-alpine AS builder

WORKDIR /src

COPY frontend/package*.json ./
RUN npm ci

COPY frontend ./

ARG VITE_API_BASE_URL=
ARG VITE_COURSE_ID=10000000-0000-0000-0000-000000000001
ARG VITE_COURSE_SLUG=homemade-bagels-for-beginners

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_COURSE_ID=$VITE_COURSE_ID
ENV VITE_COURSE_SLUG=$VITE_COURSE_SLUG

RUN npm run build

FROM nginx:1.27-alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /src/dist /usr/share/nginx/html

EXPOSE 80
