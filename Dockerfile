FROM node:20-alpine

WORKDIR /app

# Copy package info and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY src ./src

# Create token.json file placeholder so it can be mounted or persisted
RUN touch token.json

# Expose the configured port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
