FROM node:22-alpine

# Install Angular CLI globally
RUN npm install -g @angular/cli@latest

WORKDIR /app

# Copy package files and install deps if they exist
COPY package*.json ./
RUN if [ -f "package.json" ]; then npm install; fi

# Copy the rest of the app
COPY . .

EXPOSE 4200

# Serve with polling for Docker volume hot-reload (Windows/macOS)
CMD ["ng", "serve", "--host", "0.0.0.0", "--poll", "2000"]

