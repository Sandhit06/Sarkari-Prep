FROM node:20-alpine
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN npm install
COPY packages ./packages
COPY apps/api ./apps/api
COPY data ./data
WORKDIR /app/apps/api
RUN npx prisma generate
EXPOSE 4000
CMD ["npm", "run", "dev"]