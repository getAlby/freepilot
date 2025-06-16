# ---- Frontend Build Stage ----
#FROM node:22-alpine AS frontend-builder
FROM node:22 AS frontend-builder

WORKDIR /app/frontend

# Copy package files and install dependencies
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy the rest of the frontend source code
COPY frontend/ ./

# Build the frontend
RUN yarn build

# ---- Backend Build Stage ----
#FROM node:22-alpine AS backend-builder
FROM node:22 AS backend-builder

WORKDIR /app/backend

# Copy package files and install dependencies
COPY backend/package.json backend/yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy the rest of the backend source code
COPY backend/ ./

# Build the backend
RUN yarn run db:generate
RUN yarn build

# ---- Production Stage ----
#FROM node:22-alpine
FROM node:22

# Install Goose & dependencies
RUN apt-get update && apt-get install -y curl unzip git openssh-server
RUN curl -fsSL https://github.com/block/goose/releases/download/stable/download_cli.sh | bash

# Download goose binary with NWC payment support
# https://github.com/rolznz/goose/tree/feat/nwc-streaming-payments
RUN wget --no-check-certificate "https://drive.usercontent.google.com/download?id=1v6EFqbDJT-QDZzCl4hpYp4IZnuAOtiNl&confirm=t" -O "/root/.local/bin/goose2"
RUN chmod +x /root/.local/bin/goose2

# make ssh directory, it will be configured later
RUN mkdir -p /root/.ssh && chmod 0700 /root/.ssh

# Configure SSH to automatically accept host keys
RUN echo "Host *" >> /root/.ssh/config && \
    echo "    StrictHostKeyChecking no" >> /root/.ssh/config && \
    echo "    UserKnownHostsFile=/dev/null" >> /root/.ssh/config

# Configure git
RUN git config --global user.name "freepilot-bot"
RUN git config --global user.email "215356755+freepilot-bot@users.noreply.github.com"

WORKDIR /app

# Copy backend package files and install production dependencies
COPY backend/package.json backend/yarn.lock ./backend/
RUN cd backend && yarn install --production --frozen-lockfile

# Copy built backend code from the backend-builder stage
COPY --from=backend-builder /app/backend/dist ./backend/dist

# Copy built frontend assets from the frontend-builder stage
# The backend expects these relative to its own location after build
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy Prisma schema and migrations
COPY backend/prisma ./backend/prisma/

# Expose the port the backend listens on
EXPOSE 3001

# use altered goose
ENV GOOSE_BIN="/root/.local/bin/goose2"
ENV GOOSE_DISABLE_KEYRING=1

# Command to run the backend server
CMD cd backend && yarn docker:ssh:setup && yarn db:migrate && yarn start:prod
