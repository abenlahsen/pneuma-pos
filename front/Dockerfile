FROM node:22-bookworm-slim

WORKDIR /app

# Copy package files and install the app-pinned toolchain
COPY package*.json ./
RUN if [ -f "package-lock.json" ]; then npm ci; elif [ -f "package.json" ]; then npm install; fi

# Copy the rest of the app
COPY . .

EXPOSE 4200

# Use the project-local Angular CLI with polling for Docker volume hot-reload
CMD ["npx", "ng", "serve", "--host", "0.0.0.0", "--poll", "2000"]
