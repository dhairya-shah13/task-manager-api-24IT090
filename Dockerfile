# Use official Node.js 20 LTS on Alpine Linux for a lightweight and secure image
FROM node:20-alpine

# Set working directory inside the container
WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install dependencies inside the container
RUN npm install

# Copy all project source files
COPY . .

# Expose API port
EXPOSE 5000

# Default environment configuration (overridable via --env-file or -e)
ENV PORT=5000 \
    MONGO_URI=mongodb://host.docker.internal:27017/task-manager-api \
    JWT_SECRET=super_secret_jwt_key_24IT090 \
    NOTIFICATION_DELAY_MS=2000 \
    NOTIFICATION_MODE=async \
    SIMULATE_LISTENER_ERROR=false \
    DOCKER_CONTAINER=true

# Run the API server
CMD ["npm", "start"]

