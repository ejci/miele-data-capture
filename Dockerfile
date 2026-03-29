FROM node:20-alpine

WORKDIR /app

# Copy package info and install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy application code
COPY src ./src
COPY public ./public
RUN mkdir -p data

# Expose the configured port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
