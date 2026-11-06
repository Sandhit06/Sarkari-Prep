FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/ui/package.json ./packages/ui/
RUN npm install
COPY packages ./packages
COPY apps/web ./apps/web
COPY data ./data
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["npm", "run", "dev"]