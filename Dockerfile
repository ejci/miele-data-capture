FROM node:20-alpine

WORKDIR /usr/src/app

# Copy package info and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY src ./src
COPY public ./public

# Expose the configured port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
