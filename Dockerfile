FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY frontend/package.json frontend/package-lock.json* ./frontend/
COPY server/package.json server/package-lock.json* ./server/
RUN npm install
RUN npm --prefix frontend install
RUN npm --prefix server install

COPY . .

EXPOSE 3001 5173

CMD ["npm", "run", "dev"]
